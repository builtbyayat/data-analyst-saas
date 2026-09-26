import { describe, expect, it, vi } from 'vitest';

import {
  BadRequestException,
  StreamableFile,
} from '@nestjs/common';

import type {
  WorkspaceAccessService,
} from '../workspaces/workspace-access.service.js';

import type {
  QueryHistoryService,
} from './query-history.service.js';

import type {
  QueryService,
} from './query.service.js';

import type {
  ReportService,
} from './report.service.js';

import type {
  ResultExportService,
} from './result-export.service.js';

import {
  QueryController,
} from './query.controller.js';

import type {
  SavedAnalysisService,
} from './saved-analysis.service.js';

import type {
  SavedQueryService,
} from './saved-query.service.js';

describe('QueryController', () => {
  const queryService = {
    previewDataset: vi.fn(),
    generateSqlForUser: vi.fn(),
    validateSql: vi.fn(),
    executeSql: vi.fn(),
    enqueueSqlQuery: vi.fn(),
    executeNaturalLanguageQuery: vi.fn(),
    enqueueNaturalLanguageQuery: vi.fn(),
    generateSqlForMultipleDatasets: vi.fn(),
    validateSqlForMultipleDatasets: vi.fn(),
    executeSqlForMultipleDatasets: vi.fn(),
    enqueueSqlQueryForMultipleDatasets: vi.fn(),
    executeNaturalLanguageQueryForMultipleDatasets: vi.fn(),
    enqueueNaturalLanguageQueryForMultipleDatasets: vi.fn(),
    getAnalysisJobStatus: vi.fn(),
  } as unknown as QueryService;

  const queryHistoryService = {
    listForUser: vi.fn(),
  } as unknown as QueryHistoryService;

  const workspaceAccessService = {
    requireMembership: vi.fn(),
  } as unknown as WorkspaceAccessService;

  const resultExportService = {
    toCsv: vi.fn(),
  } as unknown as ResultExportService;

  const savedQueryService = {
    createForUser: vi.fn(),
    listForUser: vi.fn(),
    getForUser: vi.fn(),
    updateForUser: vi.fn(),
    removeForUser: vi.fn(),
  } as unknown as SavedQueryService;

  const savedAnalysisService = {
    createForUser: vi.fn(),
    listForUser: vi.fn(),
    getForUser: vi.fn(),
    updateForUser: vi.fn(),
    removeForUser: vi.fn(),
  } as unknown as SavedAnalysisService;

  const reportService = {
    createForUser: vi.fn(),
    listForUser: vi.fn(),
    getForUser: vi.fn(),
    updateForUser: vi.fn(),
    removeForUser: vi.fn(),
  } as unknown as ReportService;

  const controller = new QueryController(
    queryService,
    queryHistoryService,
    workspaceAccessService,
    resultExportService,
    savedQueryService,
    savedAnalysisService,
    reportService,
  );

  const request = {
    user: {
      id: 'user-1',
    },
  } as never;

  function resetMocks(): void {
    vi.clearAllMocks();
  }

  // ==========================================
  // SAVED QUERY TESTS
  // ==========================================

  it('creates a saved query after validating workspace membership', async () => {
    resetMocks();

    workspaceAccessService.requireMembership =
      vi.fn().mockResolvedValue(
        undefined,
      );

    savedQueryService.createForUser =
      vi.fn().mockResolvedValue({
        id: 'saved-query-1',
        workspaceId: 'workspace-1',
        userId: 'user-1',
        datasetId: 'dataset-1',
        title: 'Monthly Sales',
        description: null,
        question: 'Show monthly sales',
        sql: 'SELECT * FROM dataset',
      });

    const body = {
      title: 'Monthly Sales',
      sql: 'SELECT * FROM dataset',
      question: 'Show monthly sales',
      datasetId: 'dataset-1',
    };

    const result =
      await controller.createSavedQuery(
        'workspace-1',
        body,
        request,
      );

    expect(
      workspaceAccessService.requireMembership,
    ).toHaveBeenCalledWith(
      'user-1',
      'workspace-1',
    );

    expect(
      savedQueryService.createForUser,
    ).toHaveBeenCalledWith(
      'workspace-1',
      'user-1',
      body,
    );

    expect(result.id).toBe(
      'saved-query-1',
    );
  });

  it('lists saved queries with normalized limit', async () => {
    resetMocks();

    savedQueryService.listForUser =
      vi.fn().mockResolvedValue([]);

    await controller.listSavedQueries(
      'workspace-1',
      'dataset-1',
      '25',
      request,
    );

    expect(
      workspaceAccessService.requireMembership,
    ).toHaveBeenCalledWith(
      'user-1',
      'workspace-1',
    );

    expect(
      savedQueryService.listForUser,
    ).toHaveBeenCalledWith(
      'workspace-1',
      'user-1',
      'dataset-1',
      25,
    );
  });

  it('falls back to the default saved-query limit when the limit is invalid', async () => {
    resetMocks();

    savedQueryService.listForUser =
      vi.fn().mockResolvedValue([]);

    await controller.listSavedQueries(
      'workspace-1',
      undefined,
      'invalid',
      request,
    );

    expect(
      savedQueryService.listForUser,
    ).toHaveBeenCalledWith(
      'workspace-1',
      'user-1',
      undefined,
      50,
    );
  });

  it('gets a saved query for the authenticated user', async () => {
    resetMocks();

    savedQueryService.getForUser =
      vi.fn().mockResolvedValue({
        id: 'saved-query-1',
      });

    const result =
      await controller.getSavedQuery(
        'workspace-1',
        'saved-query-1',
        request,
      );

    expect(
      savedQueryService.getForUser,
    ).toHaveBeenCalledWith(
      'workspace-1',
      'user-1',
      'saved-query-1',
    );

    expect(result).toEqual({
      id: 'saved-query-1',
    });
  });

  it('rejects an empty saved-query ID when getting a saved query', async () => {
    resetMocks();

    await expect(
      controller.getSavedQuery(
        'workspace-1',
        '   ',
        request,
      ),
    ).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(
      savedQueryService.getForUser,
    ).not.toHaveBeenCalled();
  });

  it('updates a saved query', async () => {
    resetMocks();

    savedQueryService.updateForUser =
      vi.fn().mockResolvedValue({
        id: 'saved-query-1',
        title: 'Updated Query',
      });

    const body = {
      title: 'Updated Query',
      sql: 'SELECT COUNT(*) FROM dataset',
    };

    const result =
      await controller.updateSavedQuery(
        'workspace-1',
        'saved-query-1',
        body,
        request,
      );

    expect(
      workspaceAccessService.requireMembership,
    ).toHaveBeenCalledWith(
      'user-1',
      'workspace-1',
    );

    expect(
      savedQueryService.updateForUser,
    ).toHaveBeenCalledWith(
      'workspace-1',
      'user-1',
      'saved-query-1',
      body,
    );

    expect(result.title).toBe(
      'Updated Query',
    );
  });

  it('rejects an empty saved-query ID when updating', async () => {
    resetMocks();

    await expect(
      controller.updateSavedQuery(
        'workspace-1',
        '   ',
        {
          title: 'Updated',
        },
        request,
      ),
    ).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(
      savedQueryService.updateForUser,
    ).not.toHaveBeenCalled();
  });

  it('deletes a saved query', async () => {
    resetMocks();

    savedQueryService.removeForUser =
      vi.fn().mockResolvedValue(
        undefined,
      );

    await controller.deleteSavedQuery(
      'workspace-1',
      'saved-query-1',
      request,
    );

    expect(
      workspaceAccessService.requireMembership,
    ).toHaveBeenCalledWith(
      'user-1',
      'workspace-1',
    );

    expect(
      savedQueryService.removeForUser,
    ).toHaveBeenCalledWith(
      'workspace-1',
      'user-1',
      'saved-query-1',
    );
  });

  it('rejects an empty saved-query ID when deleting', async () => {
    resetMocks();

    await expect(
      controller.deleteSavedQuery(
        'workspace-1',
        '   ',
        request,
      ),
    ).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(
      savedQueryService.removeForUser,
    ).not.toHaveBeenCalled();
  });

  // ==========================================
  // SAVED ANALYSIS TESTS
  // ==========================================

  it('creates a saved analysis after validating workspace membership', async () => {
    resetMocks();

    savedAnalysisService.createForUser =
      vi.fn().mockResolvedValue({
        id: 'analysis-1',
        workspaceId: 'workspace-1',
        userId: 'user-1',
        datasetIds: ['dataset-1'],
        title: 'Monthly Sales Analysis',
        description: 'Sales summary',
        question: 'Show monthly sales',
        sql: 'SELECT month, SUM(sales) FROM dataset GROUP BY month',
        resultSnapshot: {
          rows: [
            {
              month: '2026-01',
              total: 1500,
            },
          ],
        },
      });

    const body = {
      title: 'Monthly Sales Analysis',
      description: 'Sales summary',
      question: 'Show monthly sales',
      sql: 'SELECT month, SUM(sales) FROM dataset GROUP BY month',
      datasetIds: ['dataset-1'],
      resultSnapshot: {
        rows: [
          {
            month: '2026-01',
            total: 1500,
          },
        ],
      },
    };

    const result =
      await controller.createSavedAnalysis(
        'workspace-1',
        body,
        request,
      );

    expect(
      workspaceAccessService.requireMembership,
    ).toHaveBeenCalledWith(
      'user-1',
      'workspace-1',
    );

    expect(
      savedAnalysisService.createForUser,
    ).toHaveBeenCalledWith(
      'workspace-1',
      'user-1',
      body,
    );

    expect(result.id).toBe(
      'analysis-1',
    );
  });

  it('lists saved analyses with dataset and limit filters', async () => {
    resetMocks();

    savedAnalysisService.listForUser =
      vi.fn().mockResolvedValue([]);

    await controller.listSavedAnalyses(
      'workspace-1',
      'dataset-1',
      '25',
      request,
    );

    expect(
      workspaceAccessService.requireMembership,
    ).toHaveBeenCalledWith(
      'user-1',
      'workspace-1',
    );

    expect(
      savedAnalysisService.listForUser,
    ).toHaveBeenCalledWith(
      'workspace-1',
      'user-1',
      'dataset-1',
      25,
    );
  });

  it('uses the default saved-analysis limit when the limit is invalid', async () => {
    resetMocks();

    savedAnalysisService.listForUser =
      vi.fn().mockResolvedValue([]);

    await controller.listSavedAnalyses(
      'workspace-1',
      undefined,
      'invalid',
      request,
    );

    expect(
      savedAnalysisService.listForUser,
    ).toHaveBeenCalledWith(
      'workspace-1',
      'user-1',
      undefined,
      50,
    );
  });

  it('gets a saved analysis for the authenticated user', async () => {
    resetMocks();

    savedAnalysisService.getForUser =
      vi.fn().mockResolvedValue({
        id: 'analysis-1',
        title: 'Monthly Sales Analysis',
      });

    const result =
      await controller.getSavedAnalysis(
        'workspace-1',
        'analysis-1',
        request,
      );

    expect(
      savedAnalysisService.getForUser,
    ).toHaveBeenCalledWith(
      'workspace-1',
      'user-1',
      'analysis-1',
    );

    expect(result).toEqual({
      id: 'analysis-1',
      title: 'Monthly Sales Analysis',
    });
  });

  it('rejects an empty saved-analysis ID when getting an analysis', async () => {
    resetMocks();

    await expect(
      controller.getSavedAnalysis(
        'workspace-1',
        '   ',
        request,
      ),
    ).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(
      savedAnalysisService.getForUser,
    ).not.toHaveBeenCalled();
  });

  it('updates a saved analysis', async () => {
    resetMocks();

    savedAnalysisService.updateForUser =
      vi.fn().mockResolvedValue({
        id: 'analysis-1',
        title: 'Updated Analysis',
      });

    const body = {
      title: 'Updated Analysis',
      sql: 'SELECT COUNT(*) FROM dataset',
      resultSnapshot: {
        rows: [
          {
            count: 5,
          },
        ],
      },
    };

    const result =
      await controller.updateSavedAnalysis(
        'workspace-1',
        'analysis-1',
        body,
        request,
      );

    expect(
      workspaceAccessService.requireMembership,
    ).toHaveBeenCalledWith(
      'user-1',
      'workspace-1',
    );

    expect(
      savedAnalysisService.updateForUser,
    ).toHaveBeenCalledWith(
      'workspace-1',
      'user-1',
      'analysis-1',
      body,
    );

    expect(result.title).toBe(
      'Updated Analysis',
    );
  });

  it('rejects an empty saved-analysis ID when updating', async () => {
    resetMocks();

    await expect(
      controller.updateSavedAnalysis(
        'workspace-1',
        '   ',
        {
          title: 'Updated',
        },
        request,
      ),
    ).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(
      savedAnalysisService.updateForUser,
    ).not.toHaveBeenCalled();
  });

  it('deletes a saved analysis', async () => {
    resetMocks();

    savedAnalysisService.removeForUser =
      vi.fn().mockResolvedValue(
        undefined,
      );

    await controller.deleteSavedAnalysis(
      'workspace-1',
      'analysis-1',
      request,
    );

    expect(
      workspaceAccessService.requireMembership,
    ).toHaveBeenCalledWith(
      'user-1',
      'workspace-1',
    );

    expect(
      savedAnalysisService.removeForUser,
    ).toHaveBeenCalledWith(
      'workspace-1',
      'user-1',
      'analysis-1',
    );
  });

  it('rejects an empty saved-analysis ID when deleting', async () => {
    resetMocks();

    await expect(
      controller.deleteSavedAnalysis(
        'workspace-1',
        '   ',
        request,
      ),
    ).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(
      savedAnalysisService.removeForUser,
    ).not.toHaveBeenCalled();
  });

  // ==========================================
  // REPORT TESTS
  // ==========================================

  it('creates a report after validating workspace membership', async () => {
    resetMocks();

    reportService.createForUser =
      vi.fn().mockResolvedValue({
        id: 'report-1',
        workspaceId: 'workspace-1',
        userId: 'user-1',
        title: 'Monthly Revenue Report',
        description: 'Revenue summary',
        savedAnalysisIds: [
          'analysis-1',
          'analysis-2',
        ],
      });

    const body = {
      title: 'Monthly Revenue Report',
      description: 'Revenue summary',
      savedAnalysisIds: [
        'analysis-1',
        'analysis-2',
      ],
    };

    const result =
      await controller.createReport(
        'workspace-1',
        body,
        request,
      );

    expect(
      workspaceAccessService.requireMembership,
    ).toHaveBeenCalledWith(
      'user-1',
      'workspace-1',
    );

    expect(
      reportService.createForUser,
    ).toHaveBeenCalledWith(
      'workspace-1',
      'user-1',
      body,
    );

    expect(result.id).toBe(
      'report-1',
    );
  });

  it('lists reports with the requested limit', async () => {
    resetMocks();

    reportService.listForUser =
      vi.fn().mockResolvedValue([]);

    await controller.listReports(
      'workspace-1',
      '25',
      request,
    );

    expect(
      workspaceAccessService.requireMembership,
    ).toHaveBeenCalledWith(
      'user-1',
      'workspace-1',
    );

    expect(
      reportService.listForUser,
    ).toHaveBeenCalledWith(
      'workspace-1',
      'user-1',
      25,
    );
  });

  it('uses the default report limit when the limit is invalid', async () => {
    resetMocks();

    reportService.listForUser =
      vi.fn().mockResolvedValue([]);

    await controller.listReports(
      'workspace-1',
      'invalid',
      request,
    );

    expect(
      reportService.listForUser,
    ).toHaveBeenCalledWith(
      'workspace-1',
      'user-1',
      50,
    );
  });

  it('gets a report for the authenticated user', async () => {
    resetMocks();

    reportService.getForUser =
      vi.fn().mockResolvedValue({
        id: 'report-1',
        title: 'Monthly Revenue Report',
      });

    const result =
      await controller.getReport(
        'workspace-1',
        'report-1',
        request,
      );

    expect(
      reportService.getForUser,
    ).toHaveBeenCalledWith(
      'workspace-1',
      'user-1',
      'report-1',
    );

    expect(result).toEqual({
      id: 'report-1',
      title: 'Monthly Revenue Report',
    });
  });

  it('rejects an empty report ID when getting a report', async () => {
    resetMocks();

    await expect(
      controller.getReport(
        'workspace-1',
        '   ',
        request,
      ),
    ).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(
      reportService.getForUser,
    ).not.toHaveBeenCalled();
  });

  it('updates a report', async () => {
    resetMocks();

    reportService.updateForUser =
      vi.fn().mockResolvedValue({
        id: 'report-1',
        title: 'Updated Revenue Report',
      });

    const body = {
      title: 'Updated Revenue Report',
      description:
        'Updated revenue summary',
      savedAnalysisIds: [
        'analysis-3',
      ],
    };

    const result =
      await controller.updateReport(
        'workspace-1',
        'report-1',
        body,
        request,
      );

    expect(
      workspaceAccessService.requireMembership,
    ).toHaveBeenCalledWith(
      'user-1',
      'workspace-1',
    );

    expect(
      reportService.updateForUser,
    ).toHaveBeenCalledWith(
      'workspace-1',
      'user-1',
      'report-1',
      body,
    );

    expect(result.title).toBe(
      'Updated Revenue Report',
    );
  });

  it('rejects an empty report ID when updating', async () => {
    resetMocks();

    await expect(
      controller.updateReport(
        'workspace-1',
        '   ',
        {
          title: 'Updated',
        },
        request,
      ),
    ).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(
      reportService.updateForUser,
    ).not.toHaveBeenCalled();
  });

  it('deletes a report', async () => {
    resetMocks();

    reportService.removeForUser =
      vi.fn().mockResolvedValue(
        undefined,
      );

    await controller.deleteReport(
      'workspace-1',
      'report-1',
      request,
    );

    expect(
      workspaceAccessService.requireMembership,
    ).toHaveBeenCalledWith(
      'user-1',
      'workspace-1',
    );

    expect(
      reportService.removeForUser,
    ).toHaveBeenCalledWith(
      'workspace-1',
      'user-1',
      'report-1',
    );
  });

  it('rejects an empty report ID when deleting', async () => {
    resetMocks();

    await expect(
      controller.deleteReport(
        'workspace-1',
        '   ',
        request,
      ),
    ).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(
      reportService.removeForUser,
    ).not.toHaveBeenCalled();
  });

  // ==========================================
  // EXISTING ROUTE REGRESSION TESTS
  // ==========================================

  it('supports the existing query-history route without changing its workspace scope', async () => {
    resetMocks();

    queryHistoryService.listForUser =
      vi.fn().mockResolvedValue([
        {
          id: 'history-1',
        },
      ]);

    const result =
      await controller.listQueryHistory(
        'workspace-1',
        'dataset-1',
        '10',
        'conversation-1',
        request,
      );

    expect(
      workspaceAccessService.requireMembership,
    ).toHaveBeenCalledWith(
      'user-1',
      'workspace-1',
    );

    expect(
      queryHistoryService.listForUser,
    ).toHaveBeenCalledWith(
      'workspace-1',
      'user-1',
      'dataset-1',
      10,
      'conversation-1',
    );

    expect(result).toEqual([
      {
        id: 'history-1',
      },
    ]);
  });

  it('preserves the existing background-analysis status route', async () => {
    resetMocks();

    queryService.getAnalysisJobStatus =
      vi.fn().mockResolvedValue({
        jobId: 'job-1',
        status: 'completed',
      });

    const result =
      await controller.getAnalysisJobStatus(
        'workspace-1',
        'job-1',
        request,
      );

    expect(
      queryService.getAnalysisJobStatus,
    ).toHaveBeenCalledWith(
      'job-1',
      'workspace-1',
      'user-1',
    );

    expect(result.status).toBe(
      'completed',
    );
  });

  it('rejects an empty analysis job ID', async () => {
    resetMocks();

    await expect(
      controller.getAnalysisJobStatus(
        'workspace-1',
        '   ',
        request,
      ),
    ).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(
      queryService.getAnalysisJobStatus,
    ).not.toHaveBeenCalled();
  });

  it('rejects multi-dataset requests with fewer than two dataset IDs', async () => {
    resetMocks();

    await expect(
      controller.executeMultiDatasetSql(
        'workspace-1',
        {
          datasetIds: ['dataset-1'],
          sql: 'SELECT 1',
        },
        request,
      ),
    ).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(
      queryService.executeSqlForMultipleDatasets,
    ).not.toHaveBeenCalled();
  });

  it('returns an exportable query result through the existing export flow', async () => {
    resetMocks();

    queryService.executeSql =
      vi.fn().mockResolvedValue({
        rows: [
          {
            total: 10,
          },
        ],
      });

    resultExportService.toCsv =
      vi.fn().mockReturnValue(
        Buffer.from(
          'total\n10\n',
        ),
      );

    const result =
      await controller.exportQueryResult(
        'workspace-1',
        'dataset-1',
        {
          sql: 'SELECT 10 AS total',
        },
        request,
      );

    expect(
      queryService.executeSql,
    ).toHaveBeenCalledWith(
      'dataset-1',
      'workspace-1',
      'user-1',
      'SELECT 10 AS total',
      null,
      null,
    );

    expect(
      resultExportService.toCsv,
    ).toHaveBeenCalled();

    expect(result).toBeInstanceOf(
      StreamableFile,
    );
  });
});