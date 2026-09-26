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
  FastAiQueryService,
} from './fast-ai-query.service.js';

interface AuthenticatedRequest
  extends ExpressRequest {
  user?: {
    id?: string;

    userId?: string;

    sub?: string;
  };
}

interface FastAiQueryBody {
  question?: string;

  conversationId?: string | null;
}

@Controller(
  'workspaces/:workspaceId',
)
@UseGuards(
  AuthGuard('jwt'),
)
export class FastAiQueryController {
  constructor(
    private readonly fastAiQueryService:
      FastAiQueryService,

    private readonly workspaceAccessService:
      WorkspaceAccessService,
  ) {}

  @Post(
    'datasets/:datasetId/query-from-question/fast',
  )
  async execute(
    @Param(
      'workspaceId',
    )
    workspaceId: string,

    @Param(
      'datasetId',
    )
    datasetId: string,

    @Body()
    body: FastAiQueryBody,

    @Request()
    request: AuthenticatedRequest,
  ) {
    const userId =
      request.user?.userId ??
      request.user?.id ??
      request.user?.sub;

    if (!userId) {
      throw new UnauthorizedException(
        'Authenticated user was not found',
      );
    }

    await this.workspaceAccessService.requireMembership(
      userId,
      workspaceId,
    );

    return this.fastAiQueryService.execute(
      datasetId,

      workspaceId,

      userId,

      body.question ??
        '',

      body.conversationId ??
        null,
    );
  }
}