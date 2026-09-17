import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Dataset } from '../datasets/dataset.entity.js';
import { WorkspacesModule } from '../workspaces/workspaces.module.js';

import { DuckDBService } from './duckdb.service.js';
import { QueryController } from './query.controller.js';
import { QueryHistory } from './query-history.entity.js';
import { QueryHistoryService } from './query-history.service.js';
import { QueryService } from './query.service.js';
import { SqlValidatorService } from './sql-validator.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Dataset,
      QueryHistory,
    ]),

    WorkspacesModule,
  ],

  controllers: [
    QueryController,
  ],

  providers: [
    DuckDBService,
    QueryService,
    QueryHistoryService,
    SqlValidatorService,
  ],

  exports: [
    DuckDBService,
    QueryService,
    QueryHistoryService,
    SqlValidatorService,
  ],
})
export class QueryModule {}