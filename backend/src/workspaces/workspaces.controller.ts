import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { WorkspaceAccessService } from './workspace-access.service.js';
import { WorkspacesService } from './workspaces.service.js';

interface CreateWorkspaceDto {
  name: string;
  slug: string;
}

@Controller('workspaces')
export class WorkspacesController {
  constructor(
    private readonly workspacesService: WorkspacesService,
    private readonly workspaceAccessService: WorkspaceAccessService,
  ) {}

  @UseGuards(AuthGuard('jwt'))
  @Post()
  async create(
    @Request() request: { user: { id: string } },
    @Body() body: CreateWorkspaceDto,
  ) {
    const name = body.name?.trim();
    const slug = body.slug?.trim().toLowerCase();

    if (!name || !slug) {
      throw new BadRequestException(
        'Workspace name and slug are required',
      );
    }

    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      throw new BadRequestException(
        'Slug may contain only lowercase letters, numbers, and hyphens',
      );
    }

    return this.workspacesService.createWorkspace(
      request.user.id,
      name,
      slug,
    );
  }

  @UseGuards(AuthGuard('jwt'))
  @Get()
  async list(
    @Request() request: { user: { id: string } },
  ) {
    return this.workspacesService.findUserWorkspaces(
      request.user.id,
    );
  }

  @UseGuards(AuthGuard('jwt'))
  @Get(':workspaceId')
  async getOne(
    @Request() request: { user: { id: string } },
    @Param('workspaceId') workspaceId: string,
  ) {
    return this.workspaceAccessService.requireMembership(
      request.user.id,
      workspaceId,
    );
  }
}