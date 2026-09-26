import { describe, expect, it, vi } from 'vitest';

import { BadRequestException, NotFoundException } from '@nestjs/common';

import type { Repository } from 'typeorm';

import type { Dataset } from '../datasets/dataset.entity.js';

import type {
  SavedQuery,
  } from './saved-query.entity.js';

import { SavedQueryService } from './saved-query.service.js';

describe('SavedQueryService', () => {
  const savedQueryRepository = {
    create: vi.fn(),
    save: vi.fn(),
    find: vi.fn(),
    findOne: vi.fn(),
    remove: vi.fn(),
  } as unknown as Repository<SavedQuery>;

  const datasetRepository = {
    findOne: vi.fn(),
  } as unknown as Repository<Dataset>;

  const sqlValidatorService = {
    validate: vi.fn(),
  };

  const service = new SavedQueryService(
    savedQueryRepository,
    datasetRepository,
    sqlValidatorService as never,
  );

  function resetMocks(): void {
    vi.clearAllMocks();

    sqlValidatorService.validate.mockReturnValue(
      '',
    );
  }

  const baseSavedQuery = {
    id: 'saved-query-1',
    workspaceId: 'workspace-1',
    userId: 'user-1',
    datasetId: 'dataset-1',
    title: 'Monthly Sales',
    description: 'Monthly sales summary',
    question: 'Show monthly sales',
    sql: 'SELECT month, SUM(sales) FROM dataset GROUP BY month',
    createdAt: new Date('2026-09-22T10:00:00.000Z'),
    updatedAt: new Date('2026-09-22T10:00:00.000Z'),
  } as SavedQuery;

  it('creates a saved query with normalized values', async () => {
    resetMocks();

    datasetRepository.findOne = vi.fn().mockResolvedValue({
      id: 'dataset-1',
      workspaceId: 'workspace-1',
    });

    savedQueryRepository.create = vi.fn(
      (value) => ({
        ...value,
        id: 'saved-query-1',
        createdAt: baseSavedQuery.createdAt,
        updatedAt: baseSavedQuery.updatedAt,
      }),
    );

    savedQueryRepository.save = vi.fn(
      async (value) => value,
    );

    const result =
      await service.createForUser(
        'workspace-1',
        'user-1',
        {
          title: '  Monthly Sales  ',
          description: '  Monthly sales summary  ',
          question: '  Show monthly sales  ',
          sql: '  SELECT month, SUM(sales) FROM dataset GROUP BY month  ',
          datasetId: 'dataset-1',
        },
      );

    expect(
      sqlValidatorService.validate,
    ).toHaveBeenCalledWith(
      'SELECT month, SUM(sales) FROM dataset GROUP BY month',
    );

    expect(
      datasetRepository.findOne,
    ).toHaveBeenCalledWith({
      where: {
        id: 'dataset-1',
        workspaceId: 'workspace-1',
      },
    });

    expect(
      savedQueryRepository.create,
    ).toHaveBeenCalledWith({
      workspaceId: 'workspace-1',
      userId: 'user-1',
      datasetId: 'dataset-1',
      title: 'Monthly Sales',
      description: 'Monthly sales summary',
      question: 'Show monthly sales',
      sql: 'SELECT month, SUM(sales) FROM dataset GROUP BY month',
    });

    expect(result).toEqual({
      id: 'saved-query-1',
      workspaceId: 'workspace-1',
      userId: 'user-1',
      datasetId: 'dataset-1',
      title: 'Monthly Sales',
      description: 'Monthly sales summary',
      question: 'Show monthly sales',
      sql: 'SELECT month, SUM(sales) FROM dataset GROUP BY month',
      createdAt: baseSavedQuery.createdAt,
      updatedAt: baseSavedQuery.updatedAt,
    });
  });

  it('allows a saved query without a dataset', async () => {
    resetMocks();

    savedQueryRepository.create = vi.fn(
      (value) => ({
        ...value,
        id: 'saved-query-2',
        createdAt: baseSavedQuery.createdAt,
        updatedAt: baseSavedQuery.updatedAt,
      }),
    );

    savedQueryRepository.save = vi.fn(
      async (value) => value,
    );

    const result =
      await service.createForUser(
        'workspace-1',
        'user-1',
        {
          title: 'Cross Dataset Query',
          sql: 'SELECT 1',
        },
      );

    expect(
      datasetRepository.findOne,
    ).not.toHaveBeenCalled();

    expect(result.datasetId).toBeNull();
  });

  it('rejects a saved query whose dataset belongs to another workspace', async () => {
    resetMocks();

    datasetRepository.findOne = vi.fn().mockResolvedValue(
      null,
    );

    await expect(
      service.createForUser(
        'workspace-1',
        'user-1',
        {
          title: 'Unsafe Dataset Reference',
          sql: 'SELECT 1',
          datasetId: 'dataset-1',
        },
      ),
    ).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(
      savedQueryRepository.create,
    ).not.toHaveBeenCalled();
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
          title: 'Invalid Query',
          sql: "SELECT * FROM read_parquet('/tmp/file.parquet')",
        },
      ),
    ).rejects.toThrow(
      'SQL function is not allowed: READ_PARQUET',
    );

    expect(
      savedQueryRepository.create,
    ).not.toHaveBeenCalled();
  });

  it('rejects an empty title', async () => {
    resetMocks();

    await expect(
      service.createForUser(
        'workspace-1',
        'user-1',
        {
          title: '   ',
          sql: 'SELECT 1',
        },
      ),
    ).rejects.toThrow(
      'Saved query title is required',
    );
  });

  it('lists saved queries only for the requested workspace and user', async () => {
    resetMocks();

    savedQueryRepository.find = vi.fn().mockResolvedValue([
      {
        ...baseSavedQuery,
      },
    ]);

    const result =
      await service.listForUser(
        'workspace-1',
        'user-1',
        'dataset-1',
        150,
      );

    expect(
      savedQueryRepository.find,
    ).toHaveBeenCalledWith({
      where: {
        workspaceId: 'workspace-1',
        userId: 'user-1',
        datasetId: 'dataset-1',
      },
      order: {
        updatedAt: 'DESC',
      },
      take: 100,
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe(
      'saved-query-1',
    );
  });

  it('gets a saved query only when it belongs to the requested user and workspace', async () => {
    resetMocks();

    savedQueryRepository.findOne = vi.fn().mockResolvedValue(
      baseSavedQuery,
    );

    const result =
      await service.getForUser(
        'workspace-1',
        'user-1',
        'saved-query-1',
      );

    expect(
      savedQueryRepository.findOne,
    ).toHaveBeenCalledWith({
      where: {
        id: 'saved-query-1',
        workspaceId: 'workspace-1',
        userId: 'user-1',
      },
    });

    expect(result.id).toBe(
      'saved-query-1',
    );
  });

  it('returns not found when another user requests the saved query', async () => {
    resetMocks();

    savedQueryRepository.findOne = vi.fn().mockResolvedValue(
      null,
    );

    await expect(
      service.getForUser(
        'workspace-1',
        'user-2',
        'saved-query-1',
      ),
    ).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('updates a saved query and revalidates changed SQL', async () => {
    resetMocks();

    const existing = {
      ...baseSavedQuery,
    };

    savedQueryRepository.findOne = vi.fn().mockResolvedValue(
      existing,
    );

    savedQueryRepository.save = vi.fn(
      async (value) => ({
        ...value,
      }),
    );

    const result =
      await service.updateForUser(
        'workspace-1',
        'user-1',
        'saved-query-1',
        {
          title: '  Updated Sales  ',
          sql: 'SELECT COUNT(*) FROM dataset',
        },
      );

    expect(
      sqlValidatorService.validate,
    ).toHaveBeenCalledWith(
      'SELECT COUNT(*) FROM dataset',
    );

    expect(
      savedQueryRepository.save,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Updated Sales',
        sql: 'SELECT COUNT(*) FROM dataset',
      }),
    );

    expect(result.title).toBe(
      'Updated Sales',
    );
    expect(result.sql).toBe(
      'SELECT COUNT(*) FROM dataset',
    );
  });

  it('updates dataset reference only when the new dataset belongs to the workspace', async () => {
    resetMocks();

    const existing = {
      ...baseSavedQuery,
    };

    savedQueryRepository.findOne = vi.fn().mockResolvedValue(
      existing,
    );

    datasetRepository.findOne = vi.fn().mockResolvedValue({
      id: 'dataset-2',
      workspaceId: 'workspace-1',
    });

    savedQueryRepository.save = vi.fn(
      async (value) => value,
    );

    const result =
      await service.updateForUser(
        'workspace-1',
        'user-1',
        'saved-query-1',
        {
          datasetId: 'dataset-2',
        },
      );

    expect(
      datasetRepository.findOne,
    ).toHaveBeenCalledWith({
      where: {
        id: 'dataset-2',
        workspaceId: 'workspace-1',
      },
    });

    expect(result.datasetId).toBe(
      'dataset-2',
    );
  });

  it('rejects an invalid SQL update', async () => {
    resetMocks();

    savedQueryRepository.findOne = vi.fn().mockResolvedValue(
      {
        ...baseSavedQuery,
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
        'saved-query-1',
        {
          sql: 'DROP TABLE dataset',
        },
      ),
    ).rejects.toThrow(
      'SQL statement type is not allowed',
    );

    expect(
      savedQueryRepository.save,
    ).not.toHaveBeenCalled();
  });

  it('deletes a saved query only for its owner', async () => {
    resetMocks();

    savedQueryRepository.findOne = vi.fn().mockResolvedValue(
      {
        ...baseSavedQuery,
      },
    );

    savedQueryRepository.remove = vi.fn().mockResolvedValue(
      undefined,
    );

    await service.removeForUser(
      'workspace-1',
      'user-1',
      'saved-query-1',
    );

    expect(
      savedQueryRepository.remove,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'saved-query-1',
        workspaceId: 'workspace-1',
        userId: 'user-1',
      }),
    );
  });

  it('does not delete a missing saved query', async () => {
    resetMocks();

    savedQueryRepository.findOne = vi.fn().mockResolvedValue(
      null,
    );

    await expect(
      service.removeForUser(
        'workspace-1',
        'user-1',
        'missing-query',
      ),
    ).rejects.toBeInstanceOf(
      NotFoundException,
    );

    expect(
      savedQueryRepository.remove,
    ).not.toHaveBeenCalled();
  });
});