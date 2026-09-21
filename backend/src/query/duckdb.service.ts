import {
  Injectable,
  OnModuleDestroy,
} from '@nestjs/common';

import {
  DuckDBConnection,
  DuckDBInstance,
  DuckDBPendingResultState,
} from '@duckdb/node-api';

export interface DuckDBQueryResult {
  columns: string[];
  rows: unknown[][];
}

export interface DuckDBQueryErrorDetails {
  message: string;
  line: number | null;
  column: number | null;
}

export class DuckDBQueryError extends Error {
  readonly code = 'DUCKDB_QUERY_ERROR';
  readonly line: number | null;
  readonly column: number | null;

  constructor(details: DuckDBQueryErrorDetails) {
    super(details.message);
    this.name = 'DuckDBQueryError';
    this.line = details.line;
    this.column = details.column;
  }
}

@Injectable()
export class DuckDBService implements OnModuleDestroy {
  private instance: DuckDBInstance | null = null;

  private readonly defaultTimeoutMs = 5000;

  async initialize(): Promise<void> {
    if (this.instance) {
      return;
    }

    this.instance =
      await DuckDBInstance.create(':memory:');
  }

  private async createConnection(): Promise<DuckDBConnection> {
    await this.initialize();

    if (!this.instance) {
      throw new Error(
        'DuckDB instance is not initialized',
      );
    }

    return this.instance.connect();
  }

  private normalizeQueryError(
    error: unknown,
  ): DuckDBQueryError {
    if (error instanceof DuckDBQueryError) {
      return error;
    }

    const rawMessage =
      error instanceof Error
        ? error.message
        : String(error);

    const message =
      rawMessage.trim() ||
      'DuckDB query failed';

    /*
     * DuckDB error messages can include source locations such as:
     *
     *   ... at line 3, column 12
     *   ... LINE 3: ...
     *             ^
     *
     * Keep parsing deliberately conservative. If DuckDB does not
     * provide a reliable location, line/column remain null.
     */
    const lineMatch =
      message.match(
        /\bline\s+(\d+)\b/i,
      );

    const columnMatch =
      message.match(
        /\bcolumn\s+(\d+)\b/i,
      );

    const line =
      lineMatch
        ? Number(lineMatch[1])
        : null;

    const column =
      columnMatch
        ? Number(columnMatch[1])
        : null;

    const normalizedLine =
      typeof line === 'number' &&
      Number.isFinite(line) &&
      line > 0
        ? line
        : null;

    const normalizedColumn =
      typeof column === 'number' &&
      Number.isFinite(column) &&
      column > 0
        ? column
        : null;

    return new DuckDBQueryError({
      message,
      line: normalizedLine,
      column: normalizedColumn,
    });
  }

  private async runQueryWithTimeout(
    connection: DuckDBConnection,
    sql: string,
    timeoutMs: number,
  ) {
    try {
      const statement =
        await connection.prepare(sql);

      const pending =
        statement.start();

      const startedAt =
        Date.now();

      while (
        pending.runTask() !==
        DuckDBPendingResultState.RESULT_READY
      ) {
        if (
          Date.now() - startedAt >=
          timeoutMs
        ) {
          throw new DuckDBQueryError({
            message:
              `DuckDB query timed out after ${timeoutMs}ms`,
            line: null,
            column: null,
          });
        }

        await new Promise<void>(
          (resolve) => {
            setTimeout(resolve, 1);
          },
        );
      }

      return await pending.getResult();
    } catch (error) {
      throw this.normalizeQueryError(error);
    }
  }

  async query(
    sql: string,
  ): Promise<DuckDBQueryResult> {
    const connection =
      await this.createConnection();

    try {
      const reader =
        await connection.runAndReadAll(sql);

      return {
        columns:
          reader.columnNames(),
        rows:
          reader.getRowsJson() as unknown[][],
      };
    } catch (error) {
      throw this.normalizeQueryError(error);
    } finally {
      connection.disconnectSync();
    }
  }

  /**
   * Validates SQL against an uploaded Parquet dataset without
   * executing the query.
   *
   * DuckDB.prepare() performs parsing and binding, allowing
   * syntax and semantic errors such as unknown columns,
   * unknown tables, invalid functions, and invalid expressions
   * to be detected before execution.
   *
   * The SQL itself is not wrapped or rewritten, so all supported
   * DuckDB SQL statement types remain available.
   */
  async validateDatasetQuery(
    parquetPath: string,
    sql: string,
  ): Promise<void> {
    const connection =
      await this.createConnection();

    try {
      const normalizedPath =
        parquetPath.replace(
          /\\/g,
          '/',
        );

      const escapedPath =
        normalizedPath.replace(
          /'/g,
          "''",
        );

      /*
       * Expose the uploaded Parquet file as the same `dataset`
       * relation used during normal query execution.
       *
       * No query execution happens here.
       */
      await connection.run(`
        CREATE OR REPLACE TEMP VIEW dataset AS
        SELECT *
        FROM read_parquet(
          '${escapedPath}'
        )
      `);

      /*
       * prepare() is intentionally used instead of runAndReadAll().
       *
       * This validates parsing and binding without executing the
       * user's SQL or modifying the dataset through execution.
       */
      await connection.prepare(sql);
    } catch (error) {
      throw this.normalizeQueryError(error);
    } finally {
      try {
        await connection.run(
          'DROP VIEW IF EXISTS dataset',
        );
      } catch {
        // Ignore cleanup errors.
      }

      connection.disconnectSync();
    }
  }

  async queryDataset(
    parquetPath: string,
    sql: string,
    timeoutMs = this.defaultTimeoutMs,
  ): Promise<DuckDBQueryResult> {
    const connection =
      await this.createConnection();

    try {
      const normalizedPath =
        parquetPath.replace(
          /\\/g,
          '/',
        );

      const escapedPath =
        normalizedPath.replace(
          /'/g,
          "''",
        );

      /*
       * The uploaded Parquet file is exposed as the
       * `dataset` relation for the duration of this connection.
       *
       * The SQL itself is executed directly.
       *
       * This intentionally does NOT wrap the query inside
       * SELECT * FROM (...) because doing so would prevent
       * valid SQL constructs/statements from being handled
       * correctly.
       */
      await connection.run(`
        CREATE OR REPLACE TEMP VIEW dataset AS
        SELECT *
        FROM read_parquet(
          '${escapedPath}'
        )
      `);

      const result =
        await this.runQueryWithTimeout(
          connection,
          sql,
          timeoutMs,
        );

      return {
        columns:
          result.columnNames(),
        rows:
          (await result.getRowsJson()) as unknown[][],
      };
    } catch (error) {
      throw this.normalizeQueryError(error);
    } finally {
      try {
        await connection.run(
          'DROP VIEW IF EXISTS dataset',
        );
      } catch {
        // Ignore cleanup errors.
      }

      connection.disconnectSync();
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.instance = null;
  }
}