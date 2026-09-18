import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AiModule } from '../ai/ai.module.js';
import { Dataset } from '../datasets/dataset.entity.js';
import { DatasetsModule } from '../datasets/datasets.module.js';
import { WorkspacesModule } from '../workspaces/workspaces.module.js';

import { DuckDBService } from './duckdb.service.js';
import { QueryController } from './query.controller.js';
import { QueryHistory } from './query-history.entity.js';
import { QueryHistoryService } from './query-history.service.js';
import { QueryService } from './query.service.js';
import { ResultExportService } from './result-export.service.js';
import { ResultSummaryService } from './result-summary.service.js';
import { ResultVisualizationService } from './result-visualization.service.js';
import { SqlExplanationService } from './sql-explanation.service.js';
import { SqlGenerationService } from './sql-generation.service.js';
import { SqlValidatorService } from './sql-validator.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Dataset,
      QueryHistory,
    ]),

    WorkspacesModule,

    DatasetsModule,

    AiModule,
  ],

  controllers: [
    QueryController,
  ],

  providers: [
    DuckDBService,

    QueryService,

    QueryHistoryService,

    SqlValidatorService,

    SqlGenerationService,

    ResultSummaryService,

    ResultVisualizationService,

    SqlExplanationService,

    ResultExportService,
  ],

  exports: [
    DuckDBService,

    QueryService,

    QueryHistoryService,

    SqlValidatorService,

    SqlGenerationService,

    ResultSummaryService,

    ResultVisualizationService,

    SqlExplanationService,

    ResultExportService,
  ],
})
export class QueryModule {}