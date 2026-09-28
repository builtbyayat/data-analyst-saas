import { Body, Controller, Get, Param, Post, Query, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request as ExpressRequest } from 'express';
import { AgentsService } from './agents.service.js';
import { WorkspaceAccessService } from '../workspaces/workspace-access.service.js';

interface AuthenticatedRequest extends ExpressRequest {
  user: {
    id: string;
    email: string;
  };
}

export interface CreateSessionBody {
  workspaceId: string;
  title?: string;
}

export interface CreateTaskBody {
  workspaceId: string;
  assignedAgent?: string;
  prompt: string;
}

@Controller('agents')
@UseGuards(AuthGuard('jwt'))
export class AgentsController {
  constructor(
    private readonly agentsService: AgentsService,
    private readonly workspaceAccessService: WorkspaceAccessService,
  ) {}

  @Post('sessions')
  async createSession(
    @Request() req: AuthenticatedRequest,
    @Body() body: CreateSessionBody,
  ) {
    await this.workspaceAccessService.requireMembership(body.workspaceId, req.user.id);
    return this.agentsService.createSession(body.workspaceId, req.user.id, body.title ?? '');
  }

  @Get('sessions')
  async getSessions(
    @Request() req: AuthenticatedRequest,
    @Query('workspaceId') workspaceId: string,
  ) {
    await this.workspaceAccessService.requireMembership(workspaceId, req.user.id);
    return this.agentsService.getSessions(workspaceId);
  }

  @Get('sessions/:id')
  async getSession(
    @Request() req: AuthenticatedRequest,
    @Param('id') sessionId: string,
    @Query('workspaceId') workspaceId: string,
  ) {
    await this.workspaceAccessService.requireMembership(workspaceId, req.user.id);
    return this.agentsService.getSession(sessionId, workspaceId);
  }

  @Post('sessions/:id/tasks')
  async createTask(
    @Request() req: AuthenticatedRequest,
    @Param('id') sessionId: string,
    @Body() body: CreateTaskBody,
  ) {
    await this.workspaceAccessService.requireMembership(body.workspaceId, req.user.id);
    return this.agentsService.createAndExecuteTask(
      sessionId,
      body.workspaceId,
      req.user.id,
      body.assignedAgent ?? 'orchestrator',
      body.prompt,
    );
  }
}
