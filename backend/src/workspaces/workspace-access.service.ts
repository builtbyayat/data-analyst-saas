import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkspaceMember } from './workspace-member.entity.js';

export type WorkspaceRole =
  WorkspaceMember['role'];

@Injectable()
export class WorkspaceAccessService {
  constructor(
    @InjectRepository(WorkspaceMember)
    private readonly memberRepository: Repository<WorkspaceMember>,
  ) {}

  async requireMembership(
    userId: string,
    workspaceId: string,
  ): Promise<WorkspaceMember> {
    const membership = await this.memberRepository.findOne({
      where: {
        userId,
        workspaceId,
      },
      relations: {
        workspace: true,
      },
    });

    if (!membership) {
      throw new NotFoundException('Workspace not found');
    }

    if (!membership.workspace) {
      throw new ForbiddenException(
        'Workspace access is not available',
      );
    }

    return membership;
  }

  async requireRole(
    userId: string,
    workspaceId: string,
    roles: readonly WorkspaceRole[],
  ): Promise<WorkspaceMember> {
    const membership = await this.requireMembership(
      userId,
      workspaceId,
    );

    if (!roles.includes(membership.role)) {
      throw new ForbiddenException(
        'You do not have permission to perform this action',
      );
    }

    return membership;
  }

  async requireAdmin(
    userId: string,
    workspaceId: string,
  ): Promise<WorkspaceMember> {
    return this.requireRole(
      userId,
      workspaceId,
      ['owner', 'admin'],
    );
  }
}
