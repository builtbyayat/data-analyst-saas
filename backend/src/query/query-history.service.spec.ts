import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  QueryHistoryService,
} from './query-history.service.js';

describe('QueryHistoryService', () => {
  let service: QueryHistoryService;

  const queryHistoryRepository = {
    find: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    service =
      new QueryHistoryService(
        queryHistoryRepository as never,
      );
  });

  it('lists history scoped to the authenticated user and workspace', async () => {
    const createdAt =
      new Date('2026-01-15T10:00:00.000Z');

    queryHistoryRepository.find.mockResolvedValue([
      {
        id: 'history-1',
        workspaceId: 'workspace-1',
        userId: 'user-1',
        datasetId: 'dataset-1',
        conversationId: 'conversation-1',
        question: 'Show total sales',
        sql: 'SELECT SUM(sales) FROM dataset',
        rowCount: 1,
        executionTimeMs: 42,
        status: 'success',
        failureType: null,
        errorMessage: null,
        createdAt,
      },
    ]);

    const result =
      await service.listForUser(
        'workspace-1',
        'user-1',
      );

    expect(
      queryHistoryRepository.find,
    ).toHaveBeenCalledWith({
      where: {
        workspaceId: 'workspace-1',
        userId: 'user-1',
      },
      order: {
        createdAt: 'DESC',
      },
      take: 50,
    });

    expect(result).toEqual([
      {
        id: 'history-1',
        datasetId: 'dataset-1',
        conversationId: 'conversation-1',
        question: 'Show total sales',
        sql: 'SELECT SUM(sales) FROM dataset',
        rowCount: 1,
        executionTimeMs: 42,
        status: 'success',
        failureType: null,
        errorMessage: null,
        createdAt,
      },
    ]);
  });

  it('filters history by dataset', async () => {
    queryHistoryRepository.find.mockResolvedValue(
      [],
    );

    await service.listForUser(
      'workspace-1',
      'user-1',
      'dataset-1',
    );

    expect(
      queryHistoryRepository.find,
    ).toHaveBeenCalledWith({
      where: {
        workspaceId: 'workspace-1',
        userId: 'user-1',
        datasetId: 'dataset-1',
      },
      order: {
        createdAt: 'DESC',
      },
      take: 50,
    });
  });

  it('filters history by conversation', async () => {
    queryHistoryRepository.find.mockResolvedValue(
      [],
    );

    await service.listForUser(
      'workspace-1',
      'user-1',
      undefined,
      20,
      'conversation-1',
    );

    expect(
      queryHistoryRepository.find,
    ).toHaveBeenCalledWith({
      where: {
        workspaceId: 'workspace-1',
        userId: 'user-1',
        conversationId:
          'conversation-1',
      },
      order: {
        createdAt: 'DESC',
      },
      take: 20,
    });
  });

  it('applies both dataset and conversation filters', async () => {
    queryHistoryRepository.find.mockResolvedValue(
      [],
    );

    await service.listForUser(
      'workspace-1',
      'user-1',
      'dataset-1',
      15,
      'conversation-1',
    );

    expect(
      queryHistoryRepository.find,
    ).toHaveBeenCalledWith({
      where: {
        workspaceId: 'workspace-1',
        userId: 'user-1',
        datasetId: 'dataset-1',
        conversationId:
          'conversation-1',
      },
      order: {
        createdAt: 'DESC',
      },
      take: 15,
    });
  });

  it('clamps a limit below one to one', async () => {
    queryHistoryRepository.find.mockResolvedValue(
      [],
    );

    await service.listForUser(
      'workspace-1',
      'user-1',
      undefined,
      0,
    );

    expect(
      queryHistoryRepository.find,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 1,
      }),
    );
  });

  it('clamps a limit above one hundred to one hundred', async () => {
    queryHistoryRepository.find.mockResolvedValue(
      [],
    );

    await service.listForUser(
      'workspace-1',
      'user-1',
      undefined,
      500,
    );

    expect(
      queryHistoryRepository.find,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 100,
      }),
    );
  });

  it('floors fractional limits', async () => {
    queryHistoryRepository.find.mockResolvedValue(
      [],
    );

    await service.listForUser(
      'workspace-1',
      'user-1',
      undefined,
      12.9,
    );

    expect(
      queryHistoryRepository.find,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 12,
      }),
    );
  });

  it('returns failed history entries with failure details', async () => {
    const createdAt =
      new Date('2026-02-01T10:00:00.000Z');

    queryHistoryRepository.find.mockResolvedValue([
      {
        id: 'history-2',
        datasetId: 'dataset-2',
        conversationId: null,
        question: 'Run unsafe query',
        sql: 'DROP TABLE dataset',
        rowCount: null,
        executionTimeMs: null,
        status: 'failed',
        failureType: 'validation',
        errorMessage:
          'Only read-only SQL queries are allowed',
        createdAt,
      },
    ]);

    const result =
      await service.listForUser(
        'workspace-1',
        'user-1',
      );

    expect(result).toEqual([
      {
        id: 'history-2',
        datasetId: 'dataset-2',
        conversationId: null,
        question: 'Run unsafe query',
        sql: 'DROP TABLE dataset',
        rowCount: null,
        executionTimeMs: null,
        status: 'failed',
        failureType: 'validation',
        errorMessage:
          'Only read-only SQL queries are allowed',
        createdAt,
      },
    ]);
  });

  it('returns an empty array when there is no history', async () => {
    queryHistoryRepository.find.mockResolvedValue(
      [],
    );

    const result =
      await service.listForUser(
        'workspace-1',
        'user-1',
      );

    expect(result).toEqual([]);
  });

  it('preserves the newest-first ordering contract', async () => {
    queryHistoryRepository.find.mockResolvedValue(
      [],
    );

    await service.listForUser(
      'workspace-1',
      'user-1',
      undefined,
      25,
    );

    expect(
      queryHistoryRepository.find,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        order: {
          createdAt: 'DESC',
        },
        take: 25,
      }),
    );
  });

  it('preserves nullable history fields', async () => {
    const createdAt =
      new Date('2026-03-01T10:00:00.000Z');

    queryHistoryRepository.find.mockResolvedValue([
      {
        id: 'history-3',
        datasetId: 'dataset-3',
        conversationId: null,
        question: null,
        sql: 'SELECT 1',
        rowCount: null,
        executionTimeMs: null,
        status: 'failed',
        failureType: 'execution',
        errorMessage: null,
        createdAt,
      },
    ]);

    const result =
      await service.listForUser(
        'workspace-1',
        'user-1',
      );

    expect(result[0]).toMatchObject({
      conversationId: null,
      question: null,
      rowCount: null,
      executionTimeMs: null,
      failureType: 'execution',
      errorMessage: null,
    });
  });
});