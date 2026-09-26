import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { ReportPresentationService } from './report-presentation.service.js';

describe('ReportPresentationService', () => {
  let service: ReportPresentationService;

  let reportRepository: {
    findOne: ReturnType<typeof vi.fn>;
  };

  let savedAnalysisRepository: {
    find: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    reportRepository = {
      findOne: vi.fn(),
    };

    savedAnalysisRepository = {
      find: vi.fn(),
    };

    service = new ReportPresentationService(
      reportRepository as never,
      savedAnalysisRepository as never,
    );
  });

  it('generates report sections in the saved-analysis order', async () => {
    reportRepository.findOne.mockResolvedValue({
      id: 'report-1',
      workspaceId: 'workspace-1',
      userId: 'user-1',
      title: 'Revenue Report',
      description: 'Monthly review',
      savedAnalysisIds: [
        'analysis-2',
        'analysis-1',
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    savedAnalysisRepository.find.mockResolvedValue([
      {
        id: 'analysis-1',
        workspaceId: 'workspace-1',
        userId: 'user-1',
        title: 'Second',
        description: null,
        question: 'Q2',
        datasetIds: ['dataset-2'],
        resultSnapshot: { columns: ['a'], rows: [[2]] },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'analysis-2',
        workspaceId: 'workspace-1',
        userId: 'user-1',
        title: 'First',
        description: null,
        question: 'Q1',
        datasetIds: ['dataset-1', 'dataset-3'],
        resultSnapshot: { columns: ['a'], rows: [[1]] },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const result =
      await service.generateForUser(
        'workspace-1',
        'user-1',
        'report-1',
      );

    expect(result.report.title).toBe(
      'Revenue Report',
    );
    expect(result.sections.map((section) => section.title)).toEqual([
      'First',
      'Second',
    ]);
    expect(result.sections[0].datasetCount).toBe(2);
  });

  it('counts deleted analyses without exposing them', async () => {
    reportRepository.findOne.mockResolvedValue({
      id: 'report-1',
      workspaceId: 'workspace-1',
      userId: 'user-1',
      title: 'Revenue Report',
      description: null,
      savedAnalysisIds: [
        'analysis-1',
        'analysis-2',
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    savedAnalysisRepository.find.mockResolvedValue([
      {
        id: 'analysis-1',
        workspaceId: 'workspace-1',
        userId: 'user-1',
        title: 'Available',
        description: null,
        question: null,
        datasetIds: ['dataset-1'],
        resultSnapshot: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const result =
      await service.generateForUser(
        'workspace-1',
        'user-1',
        'report-1',
      );

    expect(result.sections).toHaveLength(1);
    expect(result.missingSectionCount).toBe(1);
  });
});
