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
import { QueryService } from './query.service.js';

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

@Controller(
  'workspaces/:workspaceId/datasets',
)
@UseGuards(AuthGuard('jwt'))
export class QueryController {
  constructor(
    private readonly queryService: QueryService,

    private readonly workspaceAccessService: WorkspaceAccessService,
  ) {}

  @Get(':datasetId/preview')
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

  @Post(':datasetId/query')
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
}