import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  StreamableFile,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

import { AuthGuard } from '@nestjs/passport';

import type {
  Request as ExpressRequest,
} from 'express';

import {
  WorkspaceAccessService,
} from '../workspaces/workspace-access.service.js';

import {
  QueryHistoryService,
} from './query-history.service.js';

import {
  QueryService,
} from './query.service.js';

import {
  ReportService,
} from './report.service.js';

import type {
  CreateReportInput,
  UpdateReportInput,
} from './report.service.js';

import {
  ResultExportService,
} from './result-export.service.js';

import {
  SavedAnalysisService,
} from './saved-analysis.service.js';

import type {
  CreateSavedAnalysisInput,
  UpdateSavedAnalysisInput,
} from './saved-analysis.service.js';

import {
  SavedQueryService,
} from './saved-query.service.js';

import type {
  CreateSavedQueryInput,
  UpdateSavedQueryInput,
} from './saved-query.service.js';

interface AuthenticatedRequest
  extends ExpressRequest {
  user: {
    id?: string;
    userId?: string;
    sub?: string;
  };
}

interface ExecuteSqlBody {
  sql?: string;

  question?: string;

  conversationId?: string;
}

interface GenerateSqlBody {
  question?: string;

  conversationId?: string;
}

interface NaturalLanguageQueryBody {
  question?: string;

  conversationId?: string;
}

interface ValidateSqlBody {
  sql?: string;
}

interface MultiDatasetBody {
  datasetIds?: string[];

  sql?: string;

  question?: string;

  conversationId?: string;
}

interface MultiDatasetGenerateSqlBody {
  datasetIds?: string[];

  question?: string;

  conversationId?: string;
}

interface MultiDatasetValidateSqlBody {
  datasetIds?: string[];

  sql?: string;
}

interface MultiDatasetQueryBody {
  datasetIds?: string[];

  sql?: string;

  question?: string;

  conversationId?: string;
}

interface MultiDatasetNaturalLanguageQueryBody {
  datasetIds?: string[];

  question?: string;

  conversationId?: string;
}

@Controller(
  'workspaces/:workspaceId',
)
@UseGuards(AuthGuard('jwt'))
export class QueryController {
  constructor(
    private readonly queryService: QueryService,

    private readonly queryHistoryService:
      QueryHistoryService,

    private readonly workspaceAccessService:
      WorkspaceAccessService,

    private readonly resultExportService:
      ResultExportService,

    private readonly savedQueryService:
      SavedQueryService,

    private readonly savedAnalysisService:
      SavedAnalysisService,

    private readonly reportService:
      ReportService,
  ) {}

  // ==========================================
  // SINGLE-DATASET PREVIEW
  // ==========================================

  @Get(
    'datasets/:datasetId/preview',
  )
  async previewDataset(
    @Param('workspaceId')
    workspaceId: string,

    @Param('datasetId')
    datasetId: string,

    @Query('limit')
    limit?: string,

    @Request()
    request?: AuthenticatedRequest,
  ) {
    const userId =
      request?.user?.userId ??
      request?.user?.id ??
      request?.user?.sub;

    if (!userId) {
      throw new UnauthorizedException(
        'Authenticated user was not found',
      );
    }

    await this.workspaceAccessService.requireMembership(
      userId,
      workspaceId,
    );

    const parsedLimit =
      limit !== undefined
        ? Number(limit)
        : 100;

    return this.queryService.previewDataset(
      datasetId,
      workspaceId,
      Number.isFinite(
        parsedLimit,
      )
        ? parsedLimit
        : 100,
    );
  }

  // ==========================================
  // SINGLE-DATASET SQL GENERATION
  // ==========================================

  @Post(
    'datasets/:datasetId/generate-sql',
  )
  async generateSql(
    @Param('workspaceId')
    workspaceId: string,

    @Param('datasetId')
    datasetId: string,

    @Body()
    body: GenerateSqlBody,

    @Request()
    request?: AuthenticatedRequest,
  ) {
    const userId =
      request?.user?.userId ??
      request?.user?.id ??
      request?.user?.sub;

    if (!userId) {
      throw new UnauthorizedException(
        'Authenticated user was not found',
      );
    }

    await this.workspaceAccessService.requireMembership(
      userId,
      workspaceId,
    );

    return this.queryService.generateSqlForUser(
      datasetId,
      workspaceId,
      userId,
      body.question ?? '',
      body.conversationId ??
        null,
    );
  }

  // ==========================================
  // SINGLE-DATASET SQL VALIDATION
  // ==========================================

  @Post(
    'datasets/:datasetId/validate-sql',
  )
  async validateSql(
    @Param('workspaceId')
    workspaceId: string,

    @Param('datasetId')
    datasetId: string,

    @Body()
    body: ValidateSqlBody,

    @Request()
    request?: AuthenticatedRequest,
  ) {
    const userId =
      request?.user?.userId ??
      request?.user?.id ??
      request?.user?.sub;

    if (!userId) {
      throw new UnauthorizedException(
        'Authenticated user was not found',
      );
    }

    await this.workspaceAccessService.requireMembership(
      userId,
      workspaceId,
    );

    return this.queryService.validateSql(
      datasetId,
      workspaceId,
      body.sql ?? '',
    );
  }

  // ==========================================
  // SINGLE-DATASET SYNCHRONOUS QUERY
  // ==========================================

  @Post(
    'datasets/:datasetId/query',
  )
  async executeSql(
    @Param('workspaceId')
    workspaceId: string,

    @Param('datasetId')
    datasetId: string,

    @Body()
    body: ExecuteSqlBody,

    @Request()
    request?: AuthenticatedRequest,
  ) {
    const userId =
      request?.user?.userId ??
      request?.user?.id ??
      request?.user?.sub;

    if (!userId) {
      throw new UnauthorizedException(
        'Authenticated user was not found',
      );
    }

    await this.workspaceAccessService.requireMembership(
      userId,
      workspaceId,
    );

    return this.queryService.executeSql(
      datasetId,
      workspaceId,
      userId,
      body.sql ?? '',
      body.question ??
        null,
      body.conversationId ??
        null,
    );
  }

  // ==========================================
  // SINGLE-DATASET BACKGROUND SQL JOB
  // ==========================================

  @Post(
    'datasets/:datasetId/query/jobs',
  )
  async enqueueSqlQuery(
    @Param('workspaceId')
    workspaceId: string,

    @Param('datasetId')
    datasetId: string,

    @Body()
    body: ExecuteSqlBody,

    @Request()
    request?: AuthenticatedRequest,
  ) {
    const userId =
      request?.user?.userId ??
      request?.user?.id ??
      request?.user?.sub;

    if (!userId) {
      throw new UnauthorizedException(
        'Authenticated user was not found',
      );
    }

    await this.workspaceAccessService.requireMembership(
      userId,
      workspaceId,
    );

    if (!body.sql?.trim()) {
      throw new BadRequestException(
        'SQL query is required',
      );
    }

    return this.queryService.enqueueSqlQuery(
      datasetId,
      workspaceId,
      userId,
      body.sql,
      body.question ??
        null,
      body.conversationId ??
        null,
    );
  }

  // ==========================================
  // SINGLE-DATASET SYNCHRONOUS
  // NATURAL-LANGUAGE QUERY
  // ==========================================

  @Post(
    'datasets/:datasetId/query-from-question',
  )
  async executeNaturalLanguageQuery(
    @Param('workspaceId')
    workspaceId: string,

    @Param('datasetId')
    datasetId: string,

    @Body()
    body: NaturalLanguageQueryBody,

    @Request()
    request?: AuthenticatedRequest,
  ) {
    const userId =
      request?.user?.userId ??
      request?.user?.id ??
      request?.user?.sub;

    if (!userId) {
      throw new UnauthorizedException(
        'Authenticated user was not found',
      );
    }

    await this.workspaceAccessService.requireMembership(
      userId,
      workspaceId,
    );

    return this.queryService.executeNaturalLanguageQuery(
      datasetId,
      workspaceId,
      userId,
      body.question ?? '',
      body.conversationId ??
        null,
    );
  }

  // ==========================================
  // SINGLE-DATASET BACKGROUND
  // NATURAL-LANGUAGE JOB
  // ==========================================

  @Post(
    'datasets/:datasetId/query-from-question/jobs',
  )
  async enqueueNaturalLanguageQuery(
    @Param('workspaceId')
    workspaceId: string,

    @Param('datasetId')
    datasetId: string,

    @Body()
    body: NaturalLanguageQueryBody,

    @Request()
    request?: AuthenticatedRequest,
  ) {
    const userId =
      request?.user?.userId ??
      request?.user?.id ??
      request?.user?.sub;

    if (!userId) {
      throw new UnauthorizedException(
        'Authenticated user was not found',
      );
    }

    await this.workspaceAccessService.requireMembership(
      userId,
      workspaceId,
    );

    return this.queryService.enqueueNaturalLanguageQuery(
      datasetId,
      workspaceId,
      userId,
      body.question ?? '',
      body.conversationId ??
        null,
    );
  }

  // ==========================================
  // MULTI-DATASET INTELLIGENCE
  // ==========================================

  @Post(
    'multi-datasets/generate-sql',
  )
  async generateMultiDatasetSql(
    @Param('workspaceId')
    workspaceId: string,

    @Body()
    body: MultiDatasetGenerateSqlBody,

    @Request()
    request?: AuthenticatedRequest,
  ) {
    const userId =
      request?.user?.userId ??
      request?.user?.id ??
      request?.user?.sub;

    if (!userId) {
      throw new UnauthorizedException(
        'Authenticated user was not found',
      );
    }

    await this.workspaceAccessService.requireMembership(
      userId,
      workspaceId,
    );

    const datasetIds =
      this.requireMultiDatasetIds(
        body.datasetIds,
      );

    return this.queryService.generateSqlForMultipleDatasets(
      datasetIds,
      workspaceId,
      userId,
      body.question ?? '',
      body.conversationId ??
        null,
    );
  }

  @Post(
    'multi-datasets/validate-sql',
  )
  async validateMultiDatasetSql(
    @Param('workspaceId')
    workspaceId: string,

    @Body()
    body: MultiDatasetValidateSqlBody,

    @Request()
    request?: AuthenticatedRequest,
  ) {
    const userId =
      request?.user?.userId ??
      request?.user?.id ??
      request?.user?.sub;

    if (!userId) {
      throw new UnauthorizedException(
        'Authenticated user was not found',
      );
    }

    await this.workspaceAccessService.requireMembership(
      userId,
      workspaceId,
    );

    const datasetIds =
      this.requireMultiDatasetIds(
        body.datasetIds,
      );

    return this.queryService.validateSqlForMultipleDatasets(
      datasetIds,
      workspaceId,
      body.sql ?? '',
    );
  }

  @Post(
    'multi-datasets/query',
  )
  async executeMultiDatasetSql(
    @Param('workspaceId')
    workspaceId: string,

    @Body()
    body: MultiDatasetQueryBody,

    @Request()
    request?: AuthenticatedRequest,
  ) {
    const userId =
      request?.user?.userId ??
      request?.user?.id ??
      request?.user?.sub;

    if (!userId) {
      throw new UnauthorizedException(
        'Authenticated user was not found',
      );
    }

    await this.workspaceAccessService.requireMembership(
      userId,
      workspaceId,
    );

    const datasetIds =
      this.requireMultiDatasetIds(
        body.datasetIds,
      );

    return this.queryService.executeSqlForMultipleDatasets(
      datasetIds,
      workspaceId,
      userId,
      body.sql ?? '',
      body.question ??
        null,
      body.conversationId ??
        null,
    );
  }

  // ==========================================
  // MULTI-DATASET BACKGROUND SQL JOB
  // ==========================================

  @Post(
    'multi-datasets/query/jobs',
  )
  async enqueueMultiDatasetSql(
    @Param('workspaceId')
    workspaceId: string,

    @Body()
    body: MultiDatasetQueryBody,

    @Request()
    request?: AuthenticatedRequest,
  ) {
    const userId =
      request?.user?.userId ??
      request?.user?.id ??
      request?.user?.sub;

    if (!userId) {
      throw new UnauthorizedException(
        'Authenticated user was not found',
      );
    }

    await this.workspaceAccessService.requireMembership(
      userId,
      workspaceId,
    );

    const datasetIds =
      this.requireMultiDatasetIds(
        body.datasetIds,
      );

    if (!body.sql?.trim()) {
      throw new BadRequestException(
        'SQL query is required',
      );
    }

    return this.queryService.enqueueSqlQueryForMultipleDatasets(
      datasetIds,
      workspaceId,
      userId,
      body.sql,
      body.question ??
        null,
      body.conversationId ??
        null,
    );
  }

  @Post(
    'multi-datasets/query-from-question',
  )
  async executeMultiDatasetNaturalLanguageQuery(
    @Param('workspaceId')
    workspaceId: string,

    @Body()
    body: MultiDatasetNaturalLanguageQueryBody,

    @Request()
    request?: AuthenticatedRequest,
  ) {
    const userId =
      request?.user?.userId ??
      request?.user?.id ??
      request?.user?.sub;

    if (!userId) {
      throw new UnauthorizedException(
        'Authenticated user was not found',
      );
    }

    await this.workspaceAccessService.requireMembership(
      userId,
      workspaceId,
    );

    const datasetIds =
      this.requireMultiDatasetIds(
        body.datasetIds,
      );

    return this.queryService.executeNaturalLanguageQueryForMultipleDatasets(
      datasetIds,
      workspaceId,
      userId,
      body.question ?? '',
      body.conversationId ??
        null,
    );
  }

  // ==========================================
  // MULTI-DATASET BACKGROUND
  // NATURAL-LANGUAGE JOB
  // ==========================================

  @Post(
    'multi-datasets/query-from-question/jobs',
  )
  async enqueueMultiDatasetNaturalLanguageQuery(
    @Param('workspaceId')
    workspaceId: string,

    @Body()
    body: MultiDatasetNaturalLanguageQueryBody,

    @Request()
    request?: AuthenticatedRequest,
  ) {
    const userId =
      request?.user?.userId ??
      request?.user?.id ??
      request?.user?.sub;

    if (!userId) {
      throw new UnauthorizedException(
        'Authenticated user was not found',
      );
    }

    await this.workspaceAccessService.requireMembership(
      userId,
      workspaceId,
    );

    const datasetIds =
      this.requireMultiDatasetIds(
        body.datasetIds,
      );

    return this.queryService.enqueueNaturalLanguageQueryForMultipleDatasets(
      datasetIds,
      workspaceId,
      userId,
      body.question ?? '',
      body.conversationId ??
        null,
    );
  }

  // ==========================================
  // BACKGROUND ANALYSIS JOB STATUS
  // ==========================================

  @Get(
    'analysis-jobs/:jobId',
  )
  async getAnalysisJobStatus(
    @Param('workspaceId')
    workspaceId: string,

    @Param('jobId')
    jobId: string,

    @Request()
    request?: AuthenticatedRequest,
  ) {
    const userId =
      request?.user?.userId ??
      request?.user?.id ??
      request?.user?.sub;

    if (!userId) {
      throw new UnauthorizedException(
        'Authenticated user was not found',
      );
    }

    await this.workspaceAccessService.requireMembership(
      userId,
      workspaceId,
    );

    if (!jobId.trim()) {
      throw new BadRequestException(
        'Analysis job ID is required',
      );
    }

    return this.queryService.getAnalysisJobStatus(
      jobId.trim(),
      workspaceId,
      userId,
    );
  }

  // ==========================================
  // SAVED QUERIES
  // ==========================================

  @Post(
    'saved-queries',
  )
  async createSavedQuery(
    @Param('workspaceId')
    workspaceId: string,

    @Body()
    body: CreateSavedQueryInput,

    @Request()
    request?: AuthenticatedRequest,
  ) {
    const userId =
      request?.user?.userId ??
      request?.user?.id ??
      request?.user?.sub;

    if (!userId) {
      throw new UnauthorizedException(
        'Authenticated user was not found',
      );
    }

    await this.workspaceAccessService.requireMembership(
      userId,
      workspaceId,
    );

    return this.savedQueryService.createForUser(
      workspaceId,
      userId,
      body,
    );
  }

  @Get(
    'saved-queries',
  )
  async listSavedQueries(
    @Param('workspaceId')
    workspaceId: string,

    @Query('datasetId')
    datasetId?: string,

    @Query('limit')
    limit?: string,

    @Request()
    request?: AuthenticatedRequest,
  ) {
    const userId =
      request?.user?.userId ??
      request?.user?.id ??
      request?.user?.sub;

    if (!userId) {
      throw new UnauthorizedException(
        'Authenticated user was not found',
      );
    }

    await this.workspaceAccessService.requireMembership(
      userId,
      workspaceId,
    );

    const parsedLimit =
      limit !== undefined
        ? Number(limit)
        : 50;

    return this.savedQueryService.listForUser(
      workspaceId,
      userId,
      datasetId,
      Number.isFinite(
        parsedLimit,
      )
        ? parsedLimit
        : 50,
    );
  }

  @Get(
    'saved-queries/:savedQueryId',
  )
  async getSavedQuery(
    @Param('workspaceId')
    workspaceId: string,

    @Param('savedQueryId')
    savedQueryId: string,

    @Request()
    request?: AuthenticatedRequest,
  ) {
    const userId =
      request?.user?.userId ??
      request?.user?.id ??
      request?.user?.sub;

    if (!userId) {
      throw new UnauthorizedException(
        'Authenticated user was not found',
      );
    }

    await this.workspaceAccessService.requireMembership(
      userId,
      workspaceId,
    );

    if (!savedQueryId.trim()) {
      throw new BadRequestException(
        'Saved query ID is required',
      );
    }

    return this.savedQueryService.getForUser(
      workspaceId,
      userId,
      savedQueryId.trim(),
    );
  }

  @Patch(
    'saved-queries/:savedQueryId',
  )
  async updateSavedQuery(
    @Param('workspaceId')
    workspaceId: string,

    @Param('savedQueryId')
    savedQueryId: string,

    @Body()
    body: UpdateSavedQueryInput,

    @Request()
    request?: AuthenticatedRequest,
  ) {
    const userId =
      request?.user?.userId ??
      request?.user?.id ??
      request?.user?.sub;

    if (!userId) {
      throw new UnauthorizedException(
        'Authenticated user was not found',
      );
    }

    await this.workspaceAccessService.requireMembership(
      userId,
      workspaceId,
    );

    if (!savedQueryId.trim()) {
      throw new BadRequestException(
        'Saved query ID is required',
      );
    }

    return this.savedQueryService.updateForUser(
      workspaceId,
      userId,
      savedQueryId.trim(),
      body,
    );
  }

  @Delete(
    'saved-queries/:savedQueryId',
  )
  async deleteSavedQuery(
    @Param('workspaceId')
    workspaceId: string,

    @Param('savedQueryId')
    savedQueryId: string,

    @Request()
    request?: AuthenticatedRequest,
  ): Promise<void> {
    const userId =
      request?.user?.userId ??
      request?.user?.id ??
      request?.user?.sub;

    if (!userId) {
      throw new UnauthorizedException(
        'Authenticated user was not found',
      );
    }

    await this.workspaceAccessService.requireMembership(
      userId,
      workspaceId,
    );

    if (!savedQueryId.trim()) {
      throw new BadRequestException(
        'Saved query ID is required',
      );
    }

    await this.savedQueryService.removeForUser(
      workspaceId,
      userId,
      savedQueryId.trim(),
    );
  }

  // ==========================================
  // SAVED ANALYSES
  // ==========================================

  @Post(
    'saved-analyses',
  )
  async createSavedAnalysis(
    @Param('workspaceId')
    workspaceId: string,

    @Body()
    body: CreateSavedAnalysisInput,

    @Request()
    request?: AuthenticatedRequest,
  ) {
    const userId =
      request?.user?.userId ??
      request?.user?.id ??
      request?.user?.sub;

    if (!userId) {
      throw new UnauthorizedException(
        'Authenticated user was not found',
      );
    }

    await this.workspaceAccessService.requireMembership(
      userId,
      workspaceId,
    );

    return this.savedAnalysisService.createForUser(
      workspaceId,
      userId,
      body,
    );
  }

  @Get(
    'saved-analyses',
  )
  async listSavedAnalyses(
    @Param('workspaceId')
    workspaceId: string,

    @Query('datasetId')
    datasetId?: string,

    @Query('limit')
    limit?: string,

    @Request()
    request?: AuthenticatedRequest,
  ) {
    const userId =
      request?.user?.userId ??
      request?.user?.id ??
      request?.user?.sub;

    if (!userId) {
      throw new UnauthorizedException(
        'Authenticated user was not found',
      );
    }

    await this.workspaceAccessService.requireMembership(
      userId,
      workspaceId,
    );

    const parsedLimit =
      limit !== undefined
        ? Number(limit)
        : 50;

    return this.savedAnalysisService.listForUser(
      workspaceId,
      userId,
      datasetId,
      Number.isFinite(
        parsedLimit,
      )
        ? parsedLimit
        : 50,
    );
  }

  @Get(
    'saved-analyses/:savedAnalysisId',
  )
  async getSavedAnalysis(
    @Param('workspaceId')
    workspaceId: string,

    @Param('savedAnalysisId')
    savedAnalysisId: string,

    @Request()
    request?: AuthenticatedRequest,
  ) {
    const userId =
      request?.user?.userId ??
      request?.user?.id ??
      request?.user?.sub;

    if (!userId) {
      throw new UnauthorizedException(
        'Authenticated user was not found',
      );
    }

    await this.workspaceAccessService.requireMembership(
      userId,
      workspaceId,
    );

    if (!savedAnalysisId.trim()) {
      throw new BadRequestException(
        'Saved analysis ID is required',
      );
    }

    return this.savedAnalysisService.getForUser(
      workspaceId,
      userId,
      savedAnalysisId.trim(),
    );
  }

  @Patch(
    'saved-analyses/:savedAnalysisId',
  )
  async updateSavedAnalysis(
    @Param('workspaceId')
    workspaceId: string,

    @Param('savedAnalysisId')
    savedAnalysisId: string,

    @Body()
    body: UpdateSavedAnalysisInput,

    @Request()
    request?: AuthenticatedRequest,
  ) {
    const userId =
      request?.user?.userId ??
      request?.user?.id ??
      request?.user?.sub;

    if (!userId) {
      throw new UnauthorizedException(
        'Authenticated user was not found',
      );
    }

    await this.workspaceAccessService.requireMembership(
      userId,
      workspaceId,
    );

    if (!savedAnalysisId.trim()) {
      throw new BadRequestException(
        'Saved analysis ID is required',
      );
    }

    return this.savedAnalysisService.updateForUser(
      workspaceId,
      userId,
      savedAnalysisId.trim(),
      body,
    );
  }

  @Delete(
    'saved-analyses/:savedAnalysisId',
  )
  async deleteSavedAnalysis(
    @Param('workspaceId')
    workspaceId: string,

    @Param('savedAnalysisId')
    savedAnalysisId: string,

    @Request()
    request?: AuthenticatedRequest,
  ): Promise<void> {
    const userId =
      request?.user?.userId ??
      request?.user?.id ??
      request?.user?.sub;

    if (!userId) {
      throw new UnauthorizedException(
        'Authenticated user was not found',
      );
    }

    await this.workspaceAccessService.requireMembership(
      userId,
      workspaceId,
    );

    if (!savedAnalysisId.trim()) {
      throw new BadRequestException(
        'Saved analysis ID is required',
      );
    }

    await this.savedAnalysisService.removeForUser(
      workspaceId,
      userId,
      savedAnalysisId.trim(),
    );
  }

  // ==========================================
  // REPORTS
  // ==========================================

  @Post(
    'reports',
  )
  async createReport(
    @Param('workspaceId')
    workspaceId: string,

    @Body()
    body: CreateReportInput,

    @Request()
    request?: AuthenticatedRequest,
  ) {
    const userId =
      request?.user?.userId ??
      request?.user?.id ??
      request?.user?.sub;

    if (!userId) {
      throw new UnauthorizedException(
        'Authenticated user was not found',
      );
    }

    await this.workspaceAccessService.requireMembership(
      userId,
      workspaceId,
    );

    return this.reportService.createForUser(
      workspaceId,
      userId,
      body,
    );
  }

  @Get(
    'reports',
  )
  async listReports(
    @Param('workspaceId')
    workspaceId: string,

    @Query('limit')
    limit?: string,

    @Request()
    request?: AuthenticatedRequest,
  ) {
    const userId =
      request?.user?.userId ??
      request?.user?.id ??
      request?.user?.sub;

    if (!userId) {
      throw new UnauthorizedException(
        'Authenticated user was not found',
      );
    }

    await this.workspaceAccessService.requireMembership(
      userId,
      workspaceId,
    );

    const parsedLimit =
      limit !== undefined
        ? Number(limit)
        : 50;

    return this.reportService.listForUser(
      workspaceId,
      userId,
      Number.isFinite(
        parsedLimit,
      )
        ? parsedLimit
        : 50,
    );
  }

  @Get(
    'reports/:reportId',
  )
  async getReport(
    @Param('workspaceId')
    workspaceId: string,

    @Param('reportId')
    reportId: string,

    @Request()
    request?: AuthenticatedRequest,
  ) {
    const userId =
      request?.user?.userId ??
      request?.user?.id ??
      request?.user?.sub;

    if (!userId) {
      throw new UnauthorizedException(
        'Authenticated user was not found',
      );
    }

    await this.workspaceAccessService.requireMembership(
      userId,
      workspaceId,
    );

    if (!reportId.trim()) {
      throw new BadRequestException(
        'Report ID is required',
      );
    }

    return this.reportService.getForUser(
      workspaceId,
      userId,
      reportId.trim(),
    );
  }

  @Patch(
    'reports/:reportId',
  )
  async updateReport(
    @Param('workspaceId')
    workspaceId: string,

    @Param('reportId')
    reportId: string,

    @Body()
    body: UpdateReportInput,

    @Request()
    request?: AuthenticatedRequest,
  ) {
    const userId =
      request?.user?.userId ??
      request?.user?.id ??
      request?.user?.sub;

    if (!userId) {
      throw new UnauthorizedException(
        'Authenticated user was not found',
      );
    }

    await this.workspaceAccessService.requireMembership(
      userId,
      workspaceId,
    );

    if (!reportId.trim()) {
      throw new BadRequestException(
        'Report ID is required',
      );
    }

    return this.reportService.updateForUser(
      workspaceId,
      userId,
      reportId.trim(),
      body,
    );
  }

  @Delete(
    'reports/:reportId',
  )
  async deleteReport(
    @Param('workspaceId')
    workspaceId: string,

    @Param('reportId')
    reportId: string,

    @Request()
    request?: AuthenticatedRequest,
  ): Promise<void> {
    const userId =
      request?.user?.userId ??
      request?.user?.id ??
      request?.user?.sub;

    if (!userId) {
      throw new UnauthorizedException(
        'Authenticated user was not found',
      );
    }

    await this.workspaceAccessService.requireMembership(
      userId,
      workspaceId,
    );

    if (!reportId.trim()) {
      throw new BadRequestException(
        'Report ID is required',
      );
    }

    await this.reportService.removeForUser(
      workspaceId,
      userId,
      reportId.trim(),
    );
  }

  // ==========================================
  // SINGLE-DATASET EXPORT
  // ==========================================

  @Post(
    'datasets/:datasetId/query/export',
  )
  async exportQueryResult(
    @Param('workspaceId')
    workspaceId: string,

    @Param('datasetId')
    datasetId: string,

    @Body()
    body: ExecuteSqlBody,

    @Request()
    request?: AuthenticatedRequest,
  ): Promise<StreamableFile> {
    const userId =
      request?.user?.userId ??
      request?.user?.id ??
      request?.user?.sub;

    if (!userId) {
      throw new UnauthorizedException(
        'Authenticated user was not found',
      );
    }

    await this.workspaceAccessService.requireMembership(
      userId,
      workspaceId,
    );

    const result =
      await this.queryService.executeSql(
        datasetId,
        workspaceId,
        userId,
        body.sql ?? '',
        body.question ??
          null,
        body.conversationId ??
          null,
      );

    const csv =
      this.resultExportService.toCsv(
        result,
      );

    return new StreamableFile(
      csv,
      {
        type:
          'text/csv; charset=utf-8',

        disposition:
          'attachment; filename="query-result.csv"',

        length:
          csv.length,
      },
    );
  }

  // ==========================================
  // QUERY HISTORY
  // ==========================================

  @Get(
    'query-history',
  )
  async listQueryHistory(
    @Param('workspaceId')
    workspaceId: string,

    @Query('datasetId')
    datasetId?: string,

    @Query('limit')
    limit?: string,

    @Query('conversationId')
    conversationId?: string,

    @Request()
    request?: AuthenticatedRequest,
  ) {
    const userId =
      request?.user?.userId ??
      request?.user?.id ??
      request?.user?.sub;

    if (!userId) {
      throw new UnauthorizedException(
        'Authenticated user was not found',
      );
    }

    await this.workspaceAccessService.requireMembership(
      userId,
      workspaceId,
    );

    const parsedLimit =
      limit !== undefined
        ? Number(limit)
        : 50;

    return this.queryHistoryService.listForUser(
      workspaceId,
      userId,
      datasetId,
      Number.isFinite(
        parsedLimit,
      )
        ? parsedLimit
        : 50,
      conversationId,
    );
  }

  // ==========================================
  // VALIDATION
  // ==========================================

  private requireMultiDatasetIds(
    datasetIds:
      | string[]
      | undefined,
  ): string[] {
    if (
      !Array.isArray(
        datasetIds,
      )
    ) {
      throw new BadRequestException(
        'datasetIds must be an array of dataset IDs',
      );
    }

    const normalized =
      Array.from(
        new Set(
          datasetIds
            .filter(
              (
                datasetId,
              ): datasetId is string =>
                typeof datasetId ===
                  'string' &&
                datasetId.trim()
                  .length > 0,
            )
            .map(
              (
                datasetId,
              ) =>
                datasetId.trim(),
            ),
        ),
      );

    if (
      normalized.length <
      2
    ) {
      throw new BadRequestException(
        'At least two dataset IDs are required for multi-dataset analysis',
      );
    }

    return normalized;
  }
}