import { Module } from '@nestjs/common';

import { TypeOrmModule } from '@nestjs/typeorm';

import { BullModule } from '@nestjs/bullmq';

import { AiModule } from '../ai/ai.module.js';

import { GeminiProvider } from '../ai/gemini.provider.js';

import { BillingModule } from '../billing/billing.module.js';

import { Dataset } from '../datasets/dataset.entity.js';

import { DatasetsModule } from '../datasets/datasets.module.js';

import { WorkspacesModule } from '../workspaces/workspaces.module.js';

import { AIInsightsService } from './ai-insights.service.js';

import { SavedQueryService } from './saved-query.service.js';

import {
  DuckDBService,
} from './duckdb.service.js';

import {
  FastAiQueryController,
} from './fast-ai-query.controller.js';

import {
  FastAiQueryService,
} from './fast-ai-query.service.js';

import {
  FastSqlController,
} from './fast-sql.controller.js';

import {
  FastSqlService,
} from './fast-sql.service.js';

import {
  PythonAnalyticsService,
} from './python-analytics.service.js';

import {
  QueryController,
} from './query.controller.js';

import {
  QueryHistory,
} from './query-history.entity.js';

import {
  QueryHistoryService,
} from './query-history.service.js';

import {
  QueryService,
} from './query.service.js';

import {
  Report,
} from './report.entity.js';

import {
  ReportService,
} from './report.service.js';

import {
  ReportExportService,
} from './report-export.service.js';

import {
  ReportPresentationService,
} from './report-presentation.service.js';

import {
  ReportShareLink,
} from './report-share.entity.js';

import {
  ReportShareService,
} from './report-share.service.js';

import {
  ReportSharingController,
} from './report-sharing.controller.js';

import {
  ResultExportService,
} from './result-export.service.js';

import {
  ResultSummaryService,
} from './result-summary.service.js';

import {
  ResultVisualizationService,
} from './result-visualization.service.js';

import {
  SavedAnalysis,
} from './saved-analysis.entity.js';

import {
  SavedAnalysisService,
} from './saved-analysis.service.js';

import {
  SavedQuery,
} from './saved-query.entity.js';

import {
  SqlExplanationService,
} from './sql-explanation.service.js';

import {
  SqlGenerationService,
} from './sql-generation.service.js';

import {
  SqlValidatorService,
} from './sql-validator.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Dataset,

      QueryHistory,

      SavedQuery,

      SavedAnalysis,

      Report,

      ReportShareLink,
    ]),

    WorkspacesModule,

    DatasetsModule,

    BillingModule,

    AiModule,

    BullModule.registerQueue({
      name: 'analysis',
    }),
  ],

  controllers: [
    QueryController,

    FastSqlController,

    FastAiQueryController,

    ReportSharingController,
  ],

  providers: [
    DuckDBService,

    PythonAnalyticsService,

    GeminiProvider,

    AIInsightsService,

    QueryService,

    FastSqlService,

    FastAiQueryService,

    QueryHistoryService,

    SavedQueryService,

    SavedAnalysisService,

    ReportService,

    ReportPresentationService,

    ReportShareService,

    ReportExportService,

    SqlValidatorService,

    SqlGenerationService,

    ResultSummaryService,

    ResultVisualizationService,

    SqlExplanationService,

    ResultExportService,
  ],

  exports: [
    DuckDBService,

    PythonAnalyticsService,

    AIInsightsService,

    QueryService,

    FastSqlService,

    FastAiQueryService,

    QueryHistoryService,

    SavedQueryService,

    SavedAnalysisService,

    ReportService,

    ReportPresentationService,

    ReportShareService,

    ReportExportService,

    SqlValidatorService,

    SqlGenerationService,

    ResultSummaryService,

    ResultVisualizationService,

    SqlExplanationService,

    ResultExportService,
  ],
})
export class QueryModule {}