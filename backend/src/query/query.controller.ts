import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Request,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

import { AuthGuard } from '@nestjs/passport';

import type { Request as ExpressRequest } from 'express';

import { WorkspaceAccessService } from '../workspaces/workspace-access.service.js';

import { QueryHistoryService } from './query-history.service.js';
import { QueryService } from './query.service.js';
import { SqlGenerationService } from './sql-generation.service.js';

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
}

interface GenerateSqlBody {
  question?: string;
}

interface NaturalLanguageQueryBody {
  question?: string;
}

@Controller(
  'workspaces/:workspaceId',
)
@UseGuards(AuthGuard('jwt'))
export class QueryController {
  constructor(
    private readonly queryService: QueryService,

    private readonly queryHistoryService: QueryHistoryService,

    private readonly sqlGenerationService: SqlGenerationService,

    private readonly workspaceAccessService: WorkspaceAccessService,
  ) {}

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
      Number.isFinite(parsedLimit)
        ? parsedLimit
        : 100,
    );
  }

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

    return this.sqlGenerationService.generateSql(
      datasetId,
      workspaceId,
      body.question ?? '',
    );
  }

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
    );
  }

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
    );
  }

  @Get('query-history')
  async listQueryHistory(
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

    return this.queryHistoryService.listForUser(
      workspaceId,
      userId,
      datasetId,
      Number.isFinite(parsedLimit)
        ? parsedLimit
        : 50,
    );
  }
}