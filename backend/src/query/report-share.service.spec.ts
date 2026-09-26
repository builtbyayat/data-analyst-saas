import {
  BadRequestException,
  ForbiddenException,
  GoneException,
  NotFoundException,
} from '@nestjs/common';

import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { ReportShareService } from './report-share.service.js';

describe('ReportShareService', () => {
  let service: ReportShareService;

  let shareRepository: {
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    find: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
  };

  let reportRepository: {
    findOne: ReturnType<typeof vi.fn>;
  };

  let presentationService: {
    generateForShare: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    shareRepository = {
      create: vi.fn(),
      save: vi.fn(),
      find: vi.fn(),
      findOne: vi.fn(),
    };

    reportRepository = {
      findOne: vi.fn(),
    };

    presentationService = {
      generateForShare: vi.fn(),
    };

    service = new ReportShareService(
      shareRepository as never,
      reportRepository as never,
      presentationService as never,
    );
  });

  it('creates an expiring viewer link with a stored hash and returns the raw token once', async () => {
    const report = {
      id: 'report-1',
      workspaceId: 'workspace-1',
      userId: 'user-1',
    };

    reportRepository.findOne.mockResolvedValue(report);

    shareRepository.create.mockImplementation(
      (value) => ({
        id: 'share-1',
        ...value,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );

    shareRepository.save.mockImplementation(
      async (value) => value,
    );

    const result =
      await service.createForUser(
        'workspace-1',
        'user-1',
        'report-1',
        {
          permission: 'viewer',
          expiresInDays: 7,
        },
      );

    expect(result.id).toBe('share-1');
    expect(result.permission).toBe('viewer');
    expect(result.token).toMatch(/^[a-f0-9]{64}$/);
    expect(shareRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        reportId: 'report-1',
        workspaceId: 'workspace-1',
        createdByUserId: 'user-1',
        permission: 'viewer',
        tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        revokedAt: null,
      }),
    );
  });

  it('rejects invalid permissions and expiry values', async () => {
    reportRepository.findOne.mockResolvedValue({
      id: 'report-1',
      workspaceId: 'workspace-1',
      userId: 'user-1',
    });

    await expect(
      service.createForUser(
        'workspace-1',
        'user-1',
        'report-1',
        { permission: 'editor' },
      ),
    ).rejects.toBeInstanceOf(
      BadRequestException,
    );

    await expect(
      service.createForUser(
        'workspace-1',
        'user-1',
        'report-1',
        { expiresInDays: 31 },
      ),
    ).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects a report outside the authenticated scope', async () => {
    reportRepository.findOne.mockResolvedValue(null);

    await expect(
      service.createForUser(
        'workspace-1',
        'user-1',
        'report-1',
        {},
      ),
    ).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('resolves an active shared report and exposes export capability from permission', async () => {
    shareRepository.findOne.mockResolvedValue({
      id: 'share-1',
      reportId: 'report-1',
      permission: 'exporter',
      expiresAt: new Date(Date.now() + 86400000),
      revokedAt: null,
    });

    const generated = {
      report: { title: 'Revenue' },
      generatedAt: new Date(),
      sections: [],
      missingSectionCount: 0,
    };

    presentationService.generateForShare.mockResolvedValue(
      generated,
    );

    const result =
      await service.resolveSharedReport(
        'a'.repeat(64),
      );

    expect(result.canExport).toBe(true);
    expect(result.permission).toBe('exporter');
    expect(result.report).toBe(generated);
  });

  it('blocks export for viewer links', async () => {
    shareRepository.findOne.mockResolvedValue({
      id: 'share-1',
      reportId: 'report-1',
      permission: 'viewer',
      expiresAt: new Date(Date.now() + 86400000),
      revokedAt: null,
    });

    presentationService.generateForShare.mockResolvedValue({
      report: { title: 'Revenue' },
      generatedAt: new Date(),
      sections: [],
      missingSectionCount: 0,
    });

    await expect(
      service.assertCanExport(
        'a'.repeat(64),
      ),
    ).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rejects revoked or missing links', async () => {
    shareRepository.findOne.mockResolvedValue(null);

    await expect(
      service.resolveSharedReport(
        'a'.repeat(64),
      ),
    ).rejects.toBeInstanceOf(
      GoneException,
    );
  });
});
