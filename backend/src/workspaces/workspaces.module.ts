import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Workspace } from './workspace.entity.js';
import { WorkspaceMember } from './workspace-member.entity.js';
import { WorkspacesController } from './workspaces.controller.js';
import { WorkspacesService } from './workspaces.service.js';
import { WorkspaceAccessService } from './workspace-access.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Workspace,
      WorkspaceMember,
    ]),
  ],
  controllers: [WorkspacesController],
  providers: [
    WorkspacesService,
    WorkspaceAccessService,
  ],
  exports: [
    WorkspacesService,
    WorkspaceAccessService,
  ],
})
export class WorkspacesModule {}