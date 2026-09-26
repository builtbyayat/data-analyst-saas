import {
  Body,
  Controller,
  Param,
  Post,
  Request,
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
  FastSqlService,
} from './fast-sql.service.js';

interface AuthenticatedRequest
  extends ExpressRequest {
  user: {
    id?: string;

    userId?: string;

    sub?: string;
  };
}

interface ExecuteFastSqlBody {
  sql?: string;

  question?: string | null;

  conversationId?: string | null;
}

@Controller(
  'workspaces/:workspaceId',
)
@UseGuards(
  AuthGuard('jwt'),
)
export class FastSqlController {
  constructor(
    private readonly fastSqlService:
      FastSqlService,

    private readonly workspaceAccessService:
      WorkspaceAccessService,
  ) {}

  @Post(
    'datasets/:datasetId/query/fast',
  )
  async execute(
    @Param('workspaceId')
    workspaceId: string,

    @Param('datasetId')
    datasetId: string,

    @Body()
    body: ExecuteFastSqlBody,

    @Request()
    request: AuthenticatedRequest,
  ) {
    const userId =
      request.user.userId ??
      request.user.id ??
      request.user.sub;

    if (!userId) {
      throw new UnauthorizedException(
        'Authenticated user was not found',
      );
    }

    await this.workspaceAccessService.requireMembership(
      userId,

      workspaceId,
    );

    return this.fastSqlService.execute(
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
}