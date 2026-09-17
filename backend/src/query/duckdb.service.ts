import {
  Injectable,
  OnModuleDestroy,
} from '@nestjs/common';

import {
  DuckDBConnection,
  DuckDBInstance,
} from '@duckdb/node-api';

export interface DuckDBQueryResult {
  columns: string[];
  rows: unknown[][];
}

@Injectable()
export class DuckDBService implements OnModuleDestroy {
  private instance: DuckDBInstance | null = null;

  private connection: DuckDBConnection | null = null;

  async initialize(): Promise<void> {
    if (this.connection) {
      return;
    }

    this.instance =
      await DuckDBInstance.create(':memory:');

    this.connection =
      await this.instance.connect();
  }

  async query(
    sql: string,
  ): Promise<DuckDBQueryResult> {
    await this.initialize();

    if (!this.connection) {
      throw new Error(
        'DuckDB connection is not initialized',
      );
    }

    const reader =
      await this.connection.runAndReadAll(
        sql,
      );

    const columns =
      reader.columnNames();

    const rows =
      reader.getRowsJson() as unknown[][];

    return {
      columns,
      rows,
    };
  }

  async onModuleDestroy(): Promise<void> {
    if (this.connection) {
      this.connection.disconnectSync();

      this.connection = null;
    }

    this.instance = null;
  }
}