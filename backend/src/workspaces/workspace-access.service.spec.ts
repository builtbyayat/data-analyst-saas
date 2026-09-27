import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { WorkspaceAccessService } from './workspace-access.service.js';
import { WorkspaceMember } from './workspace-member.entity.js';

function membership(
  role: WorkspaceMember['role'],
): WorkspaceMember {
  return {
    id: 'member-1',
    workspaceId: 'workspace-1',
    userId: 'user-1',
    role,
    workspace: {
      id: 'workspace-1',
    },
  } as unknown as WorkspaceMember;
}

describe('WorkspaceAccessService', () => {
  it('rejects users who are not workspace members', async () => {
    const repository = {
      findOne: vi.fn().mockResolvedValue(null),
    };

    const service =
      new WorkspaceAccessService(
        repository as never,
      );

    await expect(
      service.requireMembership(
        'user-1',
        'workspace-1',
      ),
    ).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('allows owners and admins through requireAdmin', async () => {
    const repository = {
      findOne: vi
        .fn()
        .mockResolvedValue(
          membership('admin'),
        ),
    };

    const service =
      new WorkspaceAccessService(
        repository as never,
      );

    await expect(
      service.requireAdmin(
        'user-1',
        'workspace-1',
      ),
    ).resolves.toMatchObject({
      role: 'admin',
    });
  });

  it('rejects ordinary members from admin actions', async () => {
    const repository = {
      findOne: vi
        .fn()
        .mockResolvedValue(
          membership('member'),
        ),
    };

    const service =
      new WorkspaceAccessService(
        repository as never,
      );

    await expect(
      service.requireAdmin(
        'user-1',
        'workspace-1',
      ),
    ).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
