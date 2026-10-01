import {
  Injectable,
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

export interface DuckDBDatasetSource {
  relationName: string;
  parquetPath: string;
}

interface DuckDBSession {
  instance: DuckDBInstance;
  connection: DuckDBConnection;
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
export class DuckDBService {
  private readonly defaultTimeoutMs = 5000;

  /**
   * Create an isolated DuckDB instance for one logical operation.
   *
   * DuckDB configuration such as enable_external_access and
   * lock_configuration must not leak between requests. A shared
   * in-memory instance caused one hardened connection to affect
   * later dataset-materialization operations.
   */
  private async createSession(): Promise<DuckDBSession> {
    const instance =
      await DuckDBInstance.create(':memory:');

    try {
      const connection =
        await instance.connect();

      return {
        instance,
        connection,
      };
    } catch (error) {
      try {
        instance.closeSync();
      } catch {
        // Ignore cleanup errors.
      }

      throw error;
    }
  }

  private closeSession(
    session: DuckDBSession,
  ): void {
    try {
      session.connection.disconnectSync();
    } finally {
      try {
        session.instance.closeSync();
      } catch {
        // Ignore cleanup errors.
      }
    }
  }

  private async hardenConnection(
    connection: DuckDBConnection,
  ): Promise<void> {
    /*
     * Server-created dataset tables are established before these settings.
     * Once enabled, external file access is disabled for untrusted SQL.
     * This is defense in depth alongside SqlValidatorService.
     */
    await connection.run(
      'SET enable_external_access = false',
    );

    await connection.run(
      'SET allow_community_extensions = false',
    );

    await connection.run(
      'SET allow_unsigned_extensions = false',
    );

    await connection.run(
      'SET allow_persistent_secrets = false',
    );

    await connection.run(
      'SET allow_unredacted_secrets = false',
    );

    const memoryLimit =
      this.getMemoryLimit();

    await connection.run(
      `SET memory_limit = '${this.escapeSqlLiteral(memoryLimit)}'`,
    );

    const threads =
      this.getThreadLimit();

    await connection.run(
      `SET threads = ${threads}`,
    );

    await connection.run(
      'SET lock_configuration = true',
    );
  }

  private getMemoryLimit(): string {
    const configured =
      process.env.DUCKDB_MEMORY_LIMIT?.trim();

    if (
      configured &&
      /^\d+(?:\.\d+)?\s*(?:KB|MB|GB|TB)$/i.test(
        configured,
      )
    ) {
      return configured;
    }

    return '512MB';
  }

  private getThreadLimit(): number {
    const configured =
      Number.parseInt(
        process.env.DUCKDB_THREADS ?? '2',
        10,
      );

    if (
      !Number.isSafeInteger(configured) ||
      configured < 1 ||
      configured > 8
    ) {
      return 2;
    }

    return configured;
  }

  private escapeSqlLiteral(
    value: string,
  ): string {
    return value.replace(/'/g, "''");
  }

  private async createDatasetView(
    connection: DuckDBConnection,
    relationName: string,
    parquetPath: string,
  ): Promise<void> {
    const safeRelationName =
      relationName.replace(
        /"/g,
        '""',
      );

    const normalizedPath =
      parquetPath.replace(/\\/g, '/');

    const escapedPath =
      this.escapeSqlLiteral(
        normalizedPath,
      );

    /*
     * Materialize the parquet file into a temporary DuckDB table.
     *
     * This MUST execute before hardenConnection() disables
     * external file access.
     */
    await connection.run(`
      CREATE OR REPLACE TEMP TABLE "${safeRelationName}" AS
      SELECT *
      FROM read_parquet(
        '${escapedPath}'
      )
    `);
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

    return new DuckDBQueryError({
      message,
      line:
        typeof line === 'number' &&
        Number.isFinite(line) &&
        line > 0
          ? line
          : null,
      column:
        typeof column === 'number' &&
        Number.isFinite(column) &&
        column > 0
          ? column
          : null,
    });
  }

  async query(
    sql: string,
  ): Promise<DuckDBQueryResult> {
    const session =
      await this.createSession();

    const {
      connection,
    } = session;

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
      this.closeSession(session);
    }
  }

  async validateDatasetQuery(
    parquetPath: string,
    sql: string,
  ): Promise<void> {
    await this.validateMultipleDatasetQuery(
      [
        {
          relationName: 'dataset',
          parquetPath,
        },
      ],
      sql,
    );
  }

  async validateMultipleDatasetQuery(
    sources: DuckDBDatasetSource[],
    sql: string,
  ): Promise<void> {
    const session =
      await this.createSession();

    const {
      connection,
    } = session;

    try {
      for (const source of sources) {
        await this.createDatasetView(
          connection,
          source.relationName,
          source.parquetPath,
        );
      }

      await this.hardenConnection(
        connection,
      );

      await connection.prepare(sql);
    } catch (error) {
      throw this.normalizeQueryError(error);
    } finally {
      for (const source of sources) {
        try {
          const safeRelationName =
            source.relationName.replace(
              /"/g,
              '""',
            );

          await connection.run(
            `DROP TABLE IF EXISTS "${safeRelationName}"`,
          );
        } catch {
          // Ignore cleanup errors.
        }
      }

      this.closeSession(session);
    }
  }

  async queryDataset(
    parquetPath: string,
    sql: string,
    timeoutMs = this.defaultTimeoutMs,
  ): Promise<DuckDBQueryResult> {
    return this.queryMultipleDatasets(
      [
        {
          relationName: 'dataset',
          parquetPath,
        },
      ],
      sql,
      timeoutMs,
    );
  }

  async queryMultipleDatasets(
    sources: DuckDBDatasetSource[],
    sql: string,
    timeoutMs = this.defaultTimeoutMs,
  ): Promise<DuckDBQueryResult> {
    const session =
      await this.createSession();

    const {
      connection,
    } = session;

    try {
      for (const source of sources) {
        await this.createDatasetView(
          connection,
          source.relationName,
          source.parquetPath,
        );
      }

      await this.hardenConnection(
        connection,
      );

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
      for (const source of sources) {
        try {
          const safeRelationName =
            source.relationName.replace(
              /"/g,
              '""',
            );

          await connection.run(
            `DROP TABLE IF EXISTS "${safeRelationName}"`,
          );
        } catch {
          // Ignore cleanup errors.
        }
      }

      this.closeSession(session);
    }
  }
}