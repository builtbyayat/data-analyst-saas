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

@Injectable()
export class DuckDBService implements OnModuleDestroy {
  private instance: DuckDBInstance | null = null;

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

  private async runQueryWithTimeout(
    connection: DuckDBConnection,
    sql: string,
    timeoutMs: number,
  ) {
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
        throw new Error(
          `DuckDB query timed out after ${timeoutMs}ms`,
        );
      }

      await new Promise<void>(
        (resolve) => {
          setTimeout(
            resolve,
            1,
          );
        },
      );
    }

    return await pending.getResult();
  }

  async query(
    sql: string,
  ): Promise<DuckDBQueryResult> {
    const connection =
      await this.createConnection();

    try {
      const reader =
        await connection.runAndReadAll(
          sql,
        );

      return {
        columns:
          reader.columnNames(),

        rows:
          reader.getRowsJson() as unknown[][],
      };
    } finally {
      connection.disconnectSync();
    }
  }

  async queryDataset(
    parquetPath: string,
    sql: string,
    timeoutMs = 5000,
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