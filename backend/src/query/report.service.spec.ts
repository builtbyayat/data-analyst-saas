import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';

import {
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';

import { ReportService } from './report.service.js';

describe('ReportService', () => {
  let service: ReportService;

  let reportRepository: {
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    find: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };

  let savedAnalysisRepository: {
    find: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    reportRepository = {
      create: vi.fn(),
      save: vi.fn(),
      find: vi.fn(),
      findOne: vi.fn(),
      delete: vi.fn(),
    };

    savedAnalysisRepository = {
      find: vi.fn(),
    };

    service =
      new ReportService(
        reportRepository as never,
        savedAnalysisRepository as never,
      );
  });

  it('creates a report after validating all saved analyses', async () => {
    const report = {
      id: 'report-1',
      workspaceId: 'workspace-1',
      userId: 'user-1',
      title: 'Revenue Report',
      description:
        'Monthly revenue summary',
      savedAnalysisIds: [
        '11111111-1111-4111-8111-111111111111',
        '22222222-2222-4222-8222-222222222222',
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    savedAnalysisRepository.find.mockResolvedValue([
      {
        id: report.savedAnalysisIds[0],
      },
      {
        id: report.savedAnalysisIds[1],
      },
    ]);

    reportRepository.create.mockReturnValue(
      report,
    );

    reportRepository.save.mockResolvedValue(
      report,
    );

    const result =
      await service.createForUser(
        'workspace-1',
        'user-1',
        {
          title:
            '  Revenue Report  ',
          description:
            '  Monthly revenue summary  ',
          savedAnalysisIds:
            report.savedAnalysisIds,
        },
      );

    expect(
      savedAnalysisRepository.find,
    ).toHaveBeenCalledWith({
      where: {
        id: expect.anything(),
        workspaceId:
          'workspace-1',
        userId: 'user-1',
      },
      select: {
        id: true,
      },
    });

    expect(
      reportRepository.create,
    ).toHaveBeenCalledWith({
      workspaceId:
        'workspace-1',
      userId: 'user-1',
      title:
        'Revenue Report',
      description:
        'Monthly revenue summary',
      savedAnalysisIds:
        report.savedAnalysisIds,
    });

    expect(
      result,
    ).toEqual({
      ...report,
      savedAnalysisIds: [
        ...report.savedAnalysisIds,
      ],
    });
  });

  it('rejects a missing report title', async () => {
    await expect(
      service.createForUser(
        'workspace-1',
        'user-1',
        {
          title: '   ',
          savedAnalysisIds: [
            '11111111-1111-4111-8111-111111111111',
          ],
        },
      ),
    ).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects missing saved analyses', async () => {
    await expect(
      service.createForUser(
        'workspace-1',
        'user-1',
        {
          title: 'Revenue Report',
          savedAnalysisIds: [],
        },
      ),
    ).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects invalid saved analysis UUIDs', async () => {
    await expect(
      service.createForUser(
        'workspace-1',
        'user-1',
        {
          title: 'Revenue Report',
          savedAnalysisIds: [
            'not-a-uuid',
          ],
        },
      ),
    ).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects saved analyses outside the user workspace', async () => {
    savedAnalysisRepository.find.mockResolvedValue(
      [],
    );

    await expect(
      service.createForUser(
        'workspace-1',
        'user-1',
        {
          title: 'Revenue Report',
          savedAnalysisIds: [
            '11111111-1111-4111-8111-111111111111',
          ],
        },
      ),
    ).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('lists reports for the authenticated user only', async () => {
    reportRepository.find.mockResolvedValue([
      {
        id: 'report-1',
        workspaceId: 'workspace-1',
        userId: 'user-1',
        title: 'Revenue Report',
        description: null,
        savedAnalysisIds: [
          '11111111-1111-4111-8111-111111111111',
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const result =
      await service.listForUser(
        'workspace-1',
        'user-1',
        10,
      );

    expect(
      reportRepository.find,
    ).toHaveBeenCalledWith({
      where: {
        workspaceId:
          'workspace-1',
        userId: 'user-1',
      },
      order: {
        createdAt: 'DESC',
      },
      take: 10,
    });

    expect(
      result,
    ).toHaveLength(1);
  });

  it('uses the default list limit when the supplied limit is invalid', async () => {
    reportRepository.find.mockResolvedValue(
      [],
    );

    await service.listForUser(
      'workspace-1',
      'user-1',
      Number.NaN,
    );

    expect(
      reportRepository.find,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 50,
      }),
    );
  });

  it('caps the list limit at 100', async () => {
    reportRepository.find.mockResolvedValue(
      [],
    );

    await service.listForUser(
      'workspace-1',
      'user-1',
      500,
    );

    expect(
      reportRepository.find,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 100,
      }),
    );
  });

  it('gets a report for the authenticated user', async () => {
    const report = {
      id: '11111111-1111-4111-8111-111111111111',
      workspaceId: 'workspace-1',
      userId: 'user-1',
      title: 'Revenue Report',
      description: null,
      savedAnalysisIds: [
        '22222222-2222-4222-8222-222222222222',
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    reportRepository.findOne.mockResolvedValue(
      report,
    );

    const result =
      await service.getForUser(
        'workspace-1',
        'user-1',
        report.id,
      );

    expect(
      reportRepository.findOne,
    ).toHaveBeenCalledWith({
      where: {
        id: report.id,
        workspaceId:
          'workspace-1',
        userId: 'user-1',
      },
    });

    expect(
      result.id,
    ).toBe(report.id);
  });

  it('rejects an empty report ID', async () => {
    await expect(
      service.getForUser(
        'workspace-1',
        'user-1',
        '   ',
      ),
    ).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('returns not found for a report outside the authenticated scope', async () => {
    reportRepository.findOne.mockResolvedValue(
      null,
    );

    await expect(
      service.getForUser(
        'workspace-1',
        'user-1',
        '11111111-1111-4111-8111-111111111111',
      ),
    ).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('updates a report and revalidates saved analyses', async () => {
    const report = {
      id: '11111111-1111-4111-8111-111111111111',
      workspaceId: 'workspace-1',
      userId: 'user-1',
      title: 'Old Report',
      description: null,
      savedAnalysisIds: [
        '22222222-2222-4222-8222-222222222222',
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    reportRepository.findOne.mockResolvedValue(
      report,
    );

    savedAnalysisRepository.find.mockResolvedValue([
      {
        id: '33333333-3333-4333-8333-333333333333',
      },
    ]);

    reportRepository.save.mockImplementation(
      async (value) => value,
    );

    const result =
      await service.updateForUser(
        'workspace-1',
        'user-1',
        report.id,
        {
          title:
            'Updated Report',
          description:
            'Updated description',
          savedAnalysisIds: [
            '33333333-3333-4333-8333-333333333333',
          ],
        },
      );

    expect(
      report.title,
    ).toBe(
      'Updated Report',
    );

    expect(
      report.description,
    ).toBe(
      'Updated description',
    );

    expect(
      result.savedAnalysisIds,
    ).toEqual([
      '33333333-3333-4333-8333-333333333333',
    ]);
  });

  it('removes a report in the authenticated scope', async () => {
    reportRepository.delete.mockResolvedValue({
      affected: 1,
    });

    await service.removeForUser(
      'workspace-1',
      'user-1',
      '11111111-1111-4111-8111-111111111111',
    );

    expect(
      reportRepository.delete,
    ).toHaveBeenCalledWith({
      id: '11111111-1111-4111-8111-111111111111',
      workspaceId:
        'workspace-1',
      userId: 'user-1',
    });
  });

  it('returns not found when deleting a report outside the authenticated scope', async () => {
    reportRepository.delete.mockResolvedValue({
      affected: 0,
    });

    await expect(
      service.removeForUser(
        'workspace-1',
        'user-1',
        '11111111-1111-4111-8111-111111111111',
      ),
    ).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});