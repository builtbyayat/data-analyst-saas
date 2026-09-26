import { describe, expect, it, vi } from 'vitest';

import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';

import type { Repository } from 'typeorm';

import type { Dataset } from '../datasets/dataset.entity.js';

import type { SavedAnalysis } from './saved-analysis.entity.js';

import { SavedAnalysisService } from './saved-analysis.service.js';

describe('SavedAnalysisService', () => {
  const savedAnalysisRepository = {
    create: vi.fn(),
    save: vi.fn(),
    find: vi.fn(),
    findOne: vi.fn(),
    remove: vi.fn(),
  } as unknown as Repository<SavedAnalysis>;

  const datasetRepository = {
    find: vi.fn(),
  } as unknown as Repository<Dataset>;

  const sqlValidatorService = {
    validate: vi.fn(),
  };

  const service = new SavedAnalysisService(
    savedAnalysisRepository,
    datasetRepository,
    sqlValidatorService as never,
  );

  function resetMocks(): void {
    vi.clearAllMocks();

    sqlValidatorService.validate.mockReturnValue(
      '',
    );
  }

  const baseSavedAnalysis = {
    id: 'analysis-1',
    workspaceId: 'workspace-1',
    userId: 'user-1',
    datasetIds: ['dataset-1'],
    title: 'Monthly Sales Analysis',
    description: 'Saved monthly sales analysis',
    question: 'Show monthly sales',
    sql: 'SELECT month, SUM(sales) AS total_sales FROM dataset GROUP BY month',
    resultSnapshot: {
      rows: [
        {
          month: '2026-01',
          total_sales: 1500,
        },
      ],
      columns: [
        'month',
        'total_sales',
      ],
      summary: {
        rowCount: 1,
      },
    },
    createdAt: new Date(
      '2026-09-22T10:00:00.000Z',
    ),
    updatedAt: new Date(
      '2026-09-22T10:00:00.000Z',
    ),
  } as SavedAnalysis;

  it('creates a saved analysis with normalized values', async () => {
    resetMocks();

    datasetRepository.find = vi.fn().mockResolvedValue([
      {
        id: 'dataset-1',
        workspaceId: 'workspace-1',
      },
    ]);

    savedAnalysisRepository.create = vi.fn(
      (value) => ({
        ...value,
        id: 'analysis-1',
        createdAt:
          baseSavedAnalysis.createdAt,
        updatedAt:
          baseSavedAnalysis.updatedAt,
      }),
    );

    savedAnalysisRepository.save = vi.fn(
      async (value) => value,
    );

    const result =
      await service.createForUser(
        'workspace-1',
        'user-1',
        {
          title:
            '  Monthly Sales Analysis  ',
          description:
            '  Saved monthly sales analysis  ',
          question:
            '  Show monthly sales  ',
          sql:
            '  SELECT month, SUM(sales) AS total_sales FROM dataset GROUP BY month  ',
          datasetIds: [
            'dataset-1',
          ],
          resultSnapshot: {
            rows: [
              {
                month: '2026-01',
                total_sales: 1500,
              },
            ],
          },
        },
      );

    expect(
      sqlValidatorService.validate,
    ).toHaveBeenCalledWith(
      'SELECT month, SUM(sales) AS total_sales FROM dataset GROUP BY month',
    );

    expect(
      datasetRepository.find,
    ).toHaveBeenCalledWith({
      where: {
        workspaceId: 'workspace-1',
        id: expect.anything(),
      },
    });

    expect(
      savedAnalysisRepository.create,
    ).toHaveBeenCalledWith({
      workspaceId: 'workspace-1',
      userId: 'user-1',
      datasetIds: [
        'dataset-1',
      ],
      title:
        'Monthly Sales Analysis',
      description:
        'Saved monthly sales analysis',
      question:
        'Show monthly sales',
      sql:
        'SELECT month, SUM(sales) AS total_sales FROM dataset GROUP BY month',
      resultSnapshot: {
        rows: [
          {
            month: '2026-01',
            total_sales: 1500,
          },
        ],
      },
    });

    expect(result).toEqual({
      id: 'analysis-1',
      workspaceId: 'workspace-1',
      userId: 'user-1',
      datasetIds: [
        'dataset-1',
      ],
      title:
        'Monthly Sales Analysis',
      description:
        'Saved monthly sales analysis',
      question:
        'Show monthly sales',
      sql:
        'SELECT month, SUM(sales) AS total_sales FROM dataset GROUP BY month',
      resultSnapshot: {
        rows: [
          {
            month: '2026-01',
            total_sales: 1500,
          },
        ],
      },
      createdAt:
        baseSavedAnalysis.createdAt,
      updatedAt:
        baseSavedAnalysis.updatedAt,
    });
  });

  it('supports multiple datasets', async () => {
    resetMocks();

    datasetRepository.find = vi.fn().mockResolvedValue([
      {
        id: 'dataset-1',
        workspaceId: 'workspace-1',
      },
      {
        id: 'dataset-2',
        workspaceId: 'workspace-1',
      },
    ]);

    savedAnalysisRepository.create = vi.fn(
      (value) => ({
        ...value,
        id: 'analysis-2',
        createdAt:
          baseSavedAnalysis.createdAt,
        updatedAt:
          baseSavedAnalysis.updatedAt,
      }),
    );

    savedAnalysisRepository.save = vi.fn(
      async (value) => value,
    );

    const result =
      await service.createForUser(
        'workspace-1',
        'user-1',
        {
          title:
            'Combined Analysis',
          sql:
            'SELECT 1',
          datasetIds: [
            'dataset-1',
            'dataset-2',
          ],
          resultSnapshot: {
            rows: [
              {
                total: 100,
              },
            ],
          },
        },
      );

    expect(result.datasetIds).toEqual([
      'dataset-1',
      'dataset-2',
    ]);
  });

  it('rejects datasets from another workspace', async () => {
    resetMocks();

    datasetRepository.find = vi.fn().mockResolvedValue(
      [],
    );

    await expect(
      service.createForUser(
        'workspace-2',
        'user-1',
        {
          title:
            'Cross Workspace Analysis',
          sql:
            'SELECT 1',
          datasetIds: [
            'dataset-1',
          ],
          resultSnapshot: {
            rows: [],
          },
        },
      ),
    ).rejects.toThrow(
      'One or more datasets do not belong to this workspace',
    );

    expect(
      datasetRepository.find,
    ).toHaveBeenCalledWith({
      where: {
        workspaceId: 'workspace-2',
        id: expect.anything(),
      },
    });

    expect(
      savedAnalysisRepository.create,
    ).not.toHaveBeenCalled();
  });

  it('rejects empty dataset IDs', async () => {
    resetMocks();

    await expect(
      service.createForUser(
        'workspace-1',
        'user-1',
        {
          title:
            'Invalid Analysis',
          sql:
            'SELECT 1',
          datasetIds: [],
          resultSnapshot: {
            rows: [],
          },
        },
      ),
    ).rejects.toThrow(
      'At least one dataset ID is required',
    );
  });

  it('rejects invalid SQL', async () => {
    resetMocks();

    sqlValidatorService.validate.mockImplementation(() => {
      throw new BadRequestException(
        'SQL function is not allowed: READ_PARQUET',
      );
    });

    await expect(
      service.createForUser(
        'workspace-1',
        'user-1',
        {
          title:
            'Unsafe Analysis',
          sql:
            "SELECT * FROM read_parquet('/tmp/file.parquet')",
          datasetIds: [
            'dataset-1',
          ],
          resultSnapshot: {
            rows: [],
          },
        },
      ),
    ).rejects.toThrow(
      'SQL function is not allowed: READ_PARQUET',
    );

    expect(
      savedAnalysisRepository.create,
    ).not.toHaveBeenCalled();
  });

  it('rejects invalid result snapshots', async () => {
    resetMocks();

    datasetRepository.find = vi.fn().mockResolvedValue([
      {
        id: 'dataset-1',
        workspaceId: 'workspace-1',
      },
    ]);

    await expect(
      service.createForUser(
        'workspace-1',
        'user-1',
        {
          title:
            'Invalid Snapshot',
          sql:
            'SELECT 1',
          datasetIds: [
            'dataset-1',
          ],
          resultSnapshot:
            [] as never,
        },
      ),
    ).rejects.toThrow(
      'Result snapshot must be an object',
    );

    expect(
      savedAnalysisRepository.create,
    ).not.toHaveBeenCalled();
  });

  it('lists saved analyses scoped to workspace and user', async () => {
    resetMocks();

    savedAnalysisRepository.find =
      vi.fn().mockResolvedValue([
        {
          ...baseSavedAnalysis,
        },
      ]);

    const result =
      await service.listForUser(
        'workspace-1',
        'user-1',
        undefined,
        150,
      );

    expect(
      savedAnalysisRepository.find,
    ).toHaveBeenCalledWith({
      where: {
        workspaceId:
          'workspace-1',
        userId:
          'user-1',
      },
      order: {
        updatedAt: 'DESC',
      },
      take: 100,
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe(
      'analysis-1',
    );
  });

  it('filters saved analyses by dataset ID', async () => {
    resetMocks();

    savedAnalysisRepository.find =
      vi.fn().mockResolvedValue([
        {
          ...baseSavedAnalysis,
          id: 'analysis-1',
          datasetIds: [
            'dataset-1',
          ],
        },
        {
          ...baseSavedAnalysis,
          id: 'analysis-2',
          datasetIds: [
            'dataset-2',
          ],
        },
      ]);

    const result =
      await service.listForUser(
        'workspace-1',
        'user-1',
        'dataset-1',
      );

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe(
      'analysis-1',
    );
  });

  it('gets a saved analysis only for its owner and workspace', async () => {
    resetMocks();

    savedAnalysisRepository.findOne =
      vi.fn().mockResolvedValue(
        baseSavedAnalysis,
      );

    const result =
      await service.getForUser(
        'workspace-1',
        'user-1',
        'analysis-1',
      );

    expect(
      savedAnalysisRepository.findOne,
    ).toHaveBeenCalledWith({
      where: {
        id: 'analysis-1',
        workspaceId:
          'workspace-1',
        userId:
          'user-1',
      },
    });

    expect(result.id).toBe(
      'analysis-1',
    );

    expect(
      result.resultSnapshot,
    ).toEqual(
      baseSavedAnalysis.resultSnapshot,
    );
  });

  it('returns not found when another user requests the analysis', async () => {
    resetMocks();

    savedAnalysisRepository.findOne =
      vi.fn().mockResolvedValue(
        null,
      );

    await expect(
      service.getForUser(
        'workspace-1',
        'user-2',
        'analysis-1',
      ),
    ).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('updates title, SQL, datasets, and snapshot', async () => {
    resetMocks();

    const existing = {
      ...baseSavedAnalysis,
      datasetIds: [
        'dataset-1',
      ],
    };

    savedAnalysisRepository.findOne =
      vi.fn().mockResolvedValue(
        existing,
      );

    datasetRepository.find =
      vi.fn().mockResolvedValue([
        {
          id: 'dataset-2',
          workspaceId:
            'workspace-1',
        },
      ]);

    savedAnalysisRepository.save =
      vi.fn().mockImplementation(
        async (value) => value,
      );

    const result =
      await service.updateForUser(
        'workspace-1',
        'user-1',
        'analysis-1',
        {
          title:
            '  Updated Analysis  ',
          sql:
            'SELECT COUNT(*) FROM dataset',
          datasetIds: [
            'dataset-2',
          ],
          resultSnapshot: {
            rows: [
              {
                count: 5,
              },
            ],
          },
        },
      );

    expect(result.title).toBe(
      'Updated Analysis',
    );

    expect(result.sql).toBe(
      'SELECT COUNT(*) FROM dataset',
    );

    expect(result.datasetIds).toEqual([
      'dataset-2',
    ]);

    expect(
      result.resultSnapshot,
    ).toEqual({
      rows: [
        {
          count: 5,
        },
      ],
    });
  });

  it('rejects an invalid SQL update', async () => {
    resetMocks();

    savedAnalysisRepository.findOne =
      vi.fn().mockResolvedValue(
        {
          ...baseSavedAnalysis,
        },
      );

    sqlValidatorService.validate.mockImplementation(() => {
      throw new BadRequestException(
        'SQL statement type is not allowed',
      );
    });

    await expect(
      service.updateForUser(
        'workspace-1',
        'user-1',
        'analysis-1',
        {
          sql:
            'DROP TABLE dataset',
        },
      ),
    ).rejects.toThrow(
      'SQL statement type is not allowed',
    );

    expect(
      savedAnalysisRepository.save,
    ).not.toHaveBeenCalled();
  });

  it('deletes a saved analysis only for its owner', async () => {
    resetMocks();

    savedAnalysisRepository.findOne =
      vi.fn().mockResolvedValue(
        baseSavedAnalysis,
      );

    savedAnalysisRepository.remove =
      vi.fn().mockResolvedValue(
        undefined,
      );

    await service.removeForUser(
      'workspace-1',
      'user-1',
      'analysis-1',
    );

    expect(
      savedAnalysisRepository.remove,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'analysis-1',
        workspaceId:
          'workspace-1',
        userId:
          'user-1',
      }),
    );
  });

  it('does not delete a missing saved analysis', async () => {
    resetMocks();

    savedAnalysisRepository.findOne =
      vi.fn().mockResolvedValue(
        null,
      );

    await expect(
      service.removeForUser(
        'workspace-1',
        'user-1',
        'missing-analysis',
      ),
    ).rejects.toBeInstanceOf(
      NotFoundException,
    );

    expect(
      savedAnalysisRepository.remove,
    ).not.toHaveBeenCalled();
  });
});