import { Module } from '@nestjs/common';
import { DuckDBService } from './duckdb.service.js';

@Module({
  providers: [DuckDBService],
  exports: [DuckDBService],
})
export class QueryModule {}