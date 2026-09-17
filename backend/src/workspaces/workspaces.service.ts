import {
  Injectable,
  ConflictException,
} from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Workspace } from './workspace.entity.js';
import { WorkspaceMember } from './workspace-member.entity.js';

@Injectable()
export class WorkspacesService {
  constructor(
    @InjectRepository(Workspace)
    private readonly workspaceRepository: Repository<Workspace>,

    @InjectRepository(WorkspaceMember)
    private readonly memberRepository: Repository<WorkspaceMember>,

    private readonly dataSource: DataSource,
  ) {}

  async createWorkspace(
    userId: string,
    name: string,
    slug: string,
  ) {
    const normalizedName = name.trim();
    const normalizedSlug = slug.trim().toLowerCase();

    const existingWorkspace =
      await this.workspaceRepository.findOne({
        where: { slug: normalizedSlug },
      });

    if (existingWorkspace) {
      throw new ConflictException(
        'Workspace slug is already in use',
      );
    }

    return this.dataSource.transaction(
      async (manager) => {
        const workspace = manager.create(Workspace, {
          name: normalizedName,
          slug: normalizedSlug,
        });

        const savedWorkspace =
          await manager.save(Workspace, workspace);

        const membership = manager.create(
          WorkspaceMember,
          {
            workspaceId: savedWorkspace.id,
            userId,
            role: 'owner',
          },
        );

        await manager.save(WorkspaceMember, membership);

        return {
          workspace: {
            id: savedWorkspace.id,
            name: savedWorkspace.name,
            slug: savedWorkspace.slug,
          },
          membership: {
            role: membership.role,
          },
        };
      },
    );
  }

  async findUserWorkspaces(userId: string) {
    return this.memberRepository
      .createQueryBuilder('member')
      .innerJoinAndSelect('member.workspace', 'workspace')
      .where('member.userId = :userId', { userId })
      .select([
        'workspace.id',
        'workspace.name',
        'workspace.slug',
        'member.role',
      ])
      .getMany();
  }
}