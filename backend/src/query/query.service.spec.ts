
import {
  BadRequestException,
} from '@nestjs/common';

import {
  Test,
  TestingModule,
} from '@nestjs/testing';

import {
  getQueueToken,
} from '@nestjs/bullmq';

import {
  getRepositoryToken,
} from '@nestjs/typeorm';

import { vi } from 'vitest';

import { AiService } from '../ai/ai.service.js';
import { Dataset } from '../datasets/dataset.entity.js';
import { DatasetsService } from '../datasets/datasets.service.js';
import { StorageService } from '../storage/storage.service.js';

import { DuckDBService } from './duckdb.service.js';
import { QueryHistory } from './query-history.entity.js';
import { QueryService } from './query.service.js';
import { ResultSummaryService } from './result-summary.service.js';
import {
  ResultVisualizationService,
  type ResultVisualization,
} from './result-visualization.service.js';
import { SqlGenerationService } from './sql-generation.service.js';
import { SqlValidatorService } from './sql-validator.service.js';
import {
  AIInsightsService,
} from './ai-insights.service.js';

describe('QueryService', () => {
  let queryService: QueryService;

  const analysisQueueMock = {
    add: vi.fn(),
    getJob: vi.fn(),
  };

  const datasetRepositoryMock = {
    findOne: vi.fn(),
    find: vi.fn(),
  };

  const queryHistoryRepositoryMock = {
    create: vi.fn(),
    save: vi.fn(),
    find: vi.fn(),
  };

  const storageServiceMock = {
    download: vi.fn(),
  };

  const duckDbServiceMock = {
    queryDataset: vi.fn(),
    validateDatasetQuery: vi.fn(),
  };

  const sqlValidatorServiceMock = {
    validate: vi.fn(),
  };

  const sqlGenerationServiceMock = {
    generateSql: vi.fn(),
  };

  const resultSummaryServiceMock = {
    summarize: vi.fn(),
  };

  const resultVisualizationServiceMock = {
    analyze: vi.fn(),
  };

  const aiServiceMock = {
    generateText: vi.fn(),
  };

  const aiInsightsServiceMock = {
    generateInsights: vi.fn(),
  };

  const datasetsServiceMock = {
    getAnalysisContext: vi.fn(),
  };

  const dataset = {
    id: 'dataset-1',
    workspaceId: 'workspace-1',
    name: 'Sales Dataset',
    originalFilename: 'sales.csv',
    objectKey:
      'workspaces/workspace-1/datasets/dataset-1/original.csv',
    queryObjectKey:
      'workspaces/workspace-1/datasets/dataset-1/query.parquet',
    fileType: 'text/csv',
    fileSize: '1000',
    rowCount: 3,
    columnCount: 4,
    status: 'ready',
    columns: [],
    workspace: undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as Dataset;

  const defaultQueryResult = {
    columns: [
      'city',
      'total_sales',
    ],

    rows: [
      ['Delhi', '2400'],
      ['Lucknow', '1800'],
      ['Kanpur', '1200'],
    ],
  };

  const defaultSummary = {
    totalRows: 3,

    numericColumns: [
      {
        column: 'total_sales',
        sum: 5400,
        average: 1800,
        min: 1200,
        max: 2400,
      },
    ],
  };

  const defaultVisualization =
    {} as ResultVisualization;

  const defaultExplanation =
    'The result shows three cities with Delhi having the highest total sales, followed by Lucknow and Kanpur.';

  const defaultFollowUpQuestions = [
    'Which city has the highest total sales?',
    'How does Lucknow compare with Kanpur?',
    'What is the total sales across all cities?',
  ];

  beforeEach(async () => {
    vi.clearAllMocks();

    analysisQueueMock.add.mockResolvedValue({
      id: 'job-1',
    });

    analysisQueueMock.getJob.mockResolvedValue(
      null,
    );

    datasetRepositoryMock.findOne.mockResolvedValue(
      dataset,
    );

    datasetRepositoryMock.find.mockResolvedValue([
      dataset,
    ]);

    queryHistoryRepositoryMock.create.mockImplementation(
      (value) => value,
    );

    queryHistoryRepositoryMock.save.mockResolvedValue(
      undefined,
    );

    queryHistoryRepositoryMock.find.mockResolvedValue(
      [],
    );

    storageServiceMock.download.mockResolvedValue(
      Buffer.from('test parquet data'),
    );

    duckDbServiceMock.queryDataset.mockResolvedValue(
      defaultQueryResult,
    );

    duckDbServiceMock.validateDatasetQuery.mockResolvedValue(
      undefined,
    );

    sqlValidatorServiceMock.validate.mockImplementation(
      (sql: string) => sql,
    );

    sqlGenerationServiceMock.generateSql.mockResolvedValue(
      {
        question:
          'Show total sales by city',

        sql:
          'SELECT city, SUM(sales) AS total_sales FROM dataset GROUP BY city',

        provider:
          'test-provider',

        model:
          'test-model',
      },
    );

    resultSummaryServiceMock.summarize.mockReturnValue(
      defaultSummary,
    );

    resultVisualizationServiceMock.analyze.mockReturnValue(
      defaultVisualization,
    );

    aiServiceMock.generateText.mockImplementation(
      async ({
        systemPrompt,
      }: {
        systemPrompt?: string;
      }) => {
        if (
          systemPrompt?.includes(
            'follow-up analytical questions',
          )
        ) {
          return {
            text:
              defaultFollowUpQuestions.join(
                '\n',
              ),
            provider:
              'test-provider',
            model:
              'test-model',
            inputTokens:
              null,
            outputTokens:
              null,
          };
        }

        return {
          text:
            defaultExplanation,
          provider:
            'test-provider',
          model:
            'test-model',
          inputTokens:
            null,
          outputTokens:
            null,
        };
      },
    );

    aiInsightsServiceMock.generateInsights.mockResolvedValue(
      null,
    );

    datasetsServiceMock.getAnalysisContext.mockResolvedValue(
      {
        dataset: {
          id:
            dataset.id,

          name:
            dataset.name,

          originalFilename:
            dataset.originalFilename,

          fileType:
            dataset.fileType,

          fileSize:
            dataset.fileSize,

          rowCount:
            dataset.rowCount,

          columnCount:
            dataset.columnCount,

          status:
            dataset.status,
        },

        columns: [],
      },
    );

    const app: TestingModule =
      await Test.createTestingModule({
        providers: [
          QueryService,

          {
            provide:
              getQueueToken(
                'analysis',
              ),

            useValue:
              analysisQueueMock,
          },

          {
            provide:
              getRepositoryToken(
                Dataset,
              ),

            useValue:
              datasetRepositoryMock,
          },

          {
            provide:
              getRepositoryToken(
                QueryHistory,
              ),

            useValue:
              queryHistoryRepositoryMock,
          },

          {
            provide:
              StorageService,

            useValue:
              storageServiceMock,
          },

          {
            provide:
              DuckDBService,

            useValue:
              duckDbServiceMock,
          },

          {
            provide:
              SqlValidatorService,

            useValue:
              sqlValidatorServiceMock,
          },

          {
            provide:
              SqlGenerationService,

            useValue:
              sqlGenerationServiceMock,
          },

          {
            provide:
              ResultSummaryService,

            useValue:
              resultSummaryServiceMock,
          },

          {
            provide:
              ResultVisualizationService,

            useValue:
              resultVisualizationServiceMock,
          },

          {
            provide:
              AiService,

            useValue:
              aiServiceMock,
          },

          {
            provide:
              AIInsightsService,

            useValue:
              aiInsightsServiceMock,
          },

          {
            provide:
              DatasetsService,

            useValue:
              datasetsServiceMock,
          },
        ],
      }).compile();

    queryService =
      app.get<QueryService>(
        QueryService,
      );

    /*
     * Unit tests must not spawn the real Python analytics
     * process. The Python analytics layer is tested separately.
     */
    vi.spyOn(
      queryService as any,
      'runResultAnalytics',
    ).mockResolvedValue(
      null,
    );
  });

  // ==========================================
  // SYNCHRONOUS QUERY EXECUTION
  // ==========================================

  it('should execute a valid SQL query and return results', async () => {
    const result =
      await queryService.executeSql(
        'dataset-1',
        'workspace-1',
        'user-1',
        'SELECT city, SUM(sales) AS total_sales FROM dataset GROUP BY city',
      );

    expect(result).toEqual({
      sql:
        'SELECT city, SUM(sales) AS total_sales FROM dataset GROUP BY city',

      columns: [
        'city',
        'total_sales',
      ],

      rows: [
        ['Delhi', '2400'],
        ['Lucknow', '1800'],
        ['Kanpur', '1200'],
      ],

      rowCount: 3,

      truncated: false,

      executionTimeMs:
        expect.any(Number),

      summary:
        defaultSummary,

      visualization:
        defaultVisualization,

      explanation:
        defaultExplanation,

      analytics:
        null,

      aiInsights:
        null,

      followUpQuestions:
        [],
    });

    expect(
      resultSummaryServiceMock.summarize,
    ).toHaveBeenCalledWith(
      [
        'city',
        'total_sales',
      ],
      [
        ['Delhi', '2400'],
        ['Lucknow', '1800'],
        ['Kanpur', '1200'],
      ],
    );

    expect(
      sqlValidatorServiceMock.validate,
    ).toHaveBeenCalledWith(
      'SELECT city, SUM(sales) AS total_sales FROM dataset GROUP BY city',
    );

    expect(
      duckDbServiceMock.queryDataset,
    ).toHaveBeenCalledTimes(1);

    expect(
      storageServiceMock.download,
    ).toHaveBeenCalledWith(
      dataset.queryObjectKey,
    );

    expect(
      queryHistoryRepositoryMock.save,
    ).toHaveBeenCalledTimes(1);

    expect(
      queryHistoryRepositoryMock.create,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId:
          'workspace-1',

        datasetId:
          'dataset-1',

        userId:
          'user-1',

        status:
          'success',

        failureType:
          null,

        rowCount:
          3,

        errorMessage:
          null,
      }),
    );
  });

  it('should return an empty result correctly', async () => {
    const emptySummary = {
      totalRows: 0,
      numericColumns: [],
    };

    const sql =
      'SELECT city, SUM(sales) AS total_sales FROM dataset GROUP BY city';

    duckDbServiceMock.queryDataset.mockResolvedValue(
      {
        columns: [
          'city',
          'total_sales',
        ],

        rows: [],
      },
    );

    resultSummaryServiceMock.summarize.mockReturnValue(
      emptySummary,
    );

    const result =
      await queryService.executeSql(
        'dataset-1',
        'workspace-1',
        'user-1',
        sql,
      );

    expect(result).toEqual({
      sql,

      columns: [
        'city',
        'total_sales',
      ],

      rows: [],

      rowCount: 0,

      truncated: false,

      executionTimeMs:
        expect.any(Number),

      summary:
        emptySummary,

      visualization:
        defaultVisualization,

      explanation:
        defaultExplanation,

      analytics:
        null,

      aiInsights:
        null,

      followUpQuestions:
        [],
    });

    expect(
      queryHistoryRepositoryMock.create,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        status:
          'success',

        failureType:
          null,

        rowCount:
          0,
      }),
    );
  });

  it('should truncate results above the maximum result row limit', async () => {
    const rows =
      Array.from(
        {
          length: 5001,
        },
        (_, index) => [
          `City ${index}`,
          String(index),
        ],
      );

    const truncatedSummary = {
      totalRows: 5000,
      numericColumns: [],
    };

    duckDbServiceMock.queryDataset.mockResolvedValue(
      {
        columns: [
          'city',
          'total_sales',
        ],

        rows,
      },
    );

    resultSummaryServiceMock.summarize.mockReturnValue(
      truncatedSummary,
    );

    const result =
      await queryService.executeSql(
        'dataset-1',
        'workspace-1',
        'user-1',
        'SELECT city, sales FROM dataset',
      );

    expect(
      result.rowCount,
    ).toBe(5000);

    expect(
      result.rows,
    ).toHaveLength(5000);

    expect(
      result.truncated,
    ).toBe(true);

    expect(
      result.summary,
    ).toEqual(
      truncatedSummary,
    );

    expect(
      result.rows[0],
    ).toEqual([
      'City 0',
      '0',
    ]);

    expect(
      result.rows[4999],
    ).toEqual([
      'City 4999',
      '4999',
    ]);
  });

  it('should record execution failures and rethrow a normalized error', async () => {
    duckDbServiceMock.queryDataset.mockRejectedValue(
      new Error(
        'Binder Error: column "missing_column" not found',
      ),
    );

    await expect(
      queryService.executeSql(
        'dataset-1',
        'workspace-1',
        'user-1',
        'SELECT missing_column FROM dataset',
      ),
    ).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(
      queryHistoryRepositoryMock.create,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId:
          'workspace-1',

        datasetId:
          'dataset-1',

        userId:
          'user-1',

        sql:
          'SELECT missing_column FROM dataset',

        rowCount:
          null,

        status:
          'failed',

        failureType:
          'execution',

        errorMessage:
          'Binder Error: column "missing_column" not found',
      }),
    );

    expect(
      queryHistoryRepositoryMock.save,
    ).toHaveBeenCalledTimes(1);
  });

  it('should classify a missing queryable object as a validation failure', async () => {
    datasetRepositoryMock.findOne.mockResolvedValue(
      {
        ...dataset,
        queryObjectKey:
          null,
      },
    );

    await expect(
      queryService.executeSql(
        'dataset-1',
        'workspace-1',
        'user-1',
        'SELECT * FROM dataset',
      ),
    ).rejects.toThrow(
      'Dataset does not have a queryable Parquet object',
    );

    expect(
      queryHistoryRepositoryMock.create,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        status:
          'failed',

        failureType:
          'validation',

        rowCount:
          null,

        errorMessage:
          'Dataset does not have a queryable Parquet object',
      }),
    );

    expect(
      sqlValidatorServiceMock.validate,
    ).not.toHaveBeenCalled();

    expect(
      duckDbServiceMock.queryDataset,
    ).not.toHaveBeenCalled();
  });

  it('should execute a natural-language question end-to-end', async () => {
    const result =
      await queryService.executeNaturalLanguageQuery(
        'dataset-1',
        'workspace-1',
        'user-1',
        'Show total sales by city',
      );

    expect(
      sqlGenerationServiceMock.generateSql,
    ).toHaveBeenCalledWith(
      'dataset-1',
      'workspace-1',
      'Show total sales by city',
      [],
    );

    expect(
      aiServiceMock.generateText,
    ).toHaveBeenCalled();

    expect(
      result.result.followUpQuestions,
    ).toEqual(
      defaultFollowUpQuestions,
    );

    expect(result).toEqual({
      question:
        'Show total sales by city',

      sql:
        'SELECT city, SUM(sales) AS total_sales FROM dataset GROUP BY city',

      provider:
        'test-provider',

      model:
        'test-model',

      result: {
        sql:
          'SELECT city, SUM(sales) AS total_sales FROM dataset GROUP BY city',

        columns: [
          'city',
          'total_sales',
        ],

        rows: [
          ['Delhi', '2400'],
          ['Lucknow', '1800'],
          ['Kanpur', '1200'],
        ],

        rowCount: 3,

        truncated: false,

        executionTimeMs:
          expect.any(Number),

        summary:
          defaultSummary,

        visualization:
          defaultVisualization,

        explanation:
          defaultExplanation,

        analytics:
          null,

        aiInsights:
          null,

        followUpQuestions:
          defaultFollowUpQuestions,
      },
    });
  });

  // ==========================================
  // BACKGROUND JOB ENQUEUEING
  // ==========================================

  it('should enqueue a SQL analysis job', async () => {
    const result =
      await queryService.enqueueSqlQuery(
        'dataset-1',
        'workspace-1',
        'user-1',
        'SELECT * FROM dataset',
        'Show all sales',
        'conversation-1',
      );

    expect(
      result.queue,
    ).toBe('analysis');

    expect(
      result.status,
    ).toBe('queued');

    expect(
      result.jobId,
    ).toEqual(
      expect.any(String),
    );

    expect(
      analysisQueueMock.add,
    ).toHaveBeenCalledTimes(1);

    expect(
      analysisQueueMock.add,
    ).toHaveBeenCalledWith(
      'sql',

      {
        type:
          'sql',

        datasetIds: [
          'dataset-1',
        ],

        workspaceId:
          'workspace-1',

        userId:
          'user-1',

        sql:
          'SELECT * FROM dataset',

        question:
          'Show all sales',

        conversationId:
          'conversation-1',
      },

      expect.objectContaining({
        jobId:
          result.jobId,

        attempts:
          expect.any(Number),

        backoff: {
          type:
            'exponential',

          delay:
            expect.any(Number),
        },

        removeOnComplete:
          expect.any(Number),

        removeOnFail:
          expect.any(Number),
      }),
    );
  });

  it('should enqueue a natural-language analysis job', async () => {
    const result =
      await queryService.enqueueNaturalLanguageQuery(
        'dataset-1',
        'workspace-1',
        'user-1',
        'Show total sales by city',
        'conversation-2',
      );

    expect(
      result.queue,
    ).toBe('analysis');

    expect(
      result.status,
    ).toBe('queued');

    expect(
      analysisQueueMock.add,
    ).toHaveBeenCalledWith(
      'natural_language',

      {
        type:
          'natural_language',

        datasetIds: [
          'dataset-1',
        ],

        workspaceId:
          'workspace-1',

        userId:
          'user-1',

        question:
          'Show total sales by city',

        conversationId:
          'conversation-2',
      },

      expect.objectContaining({
        jobId:
          result.jobId,
      }),
    );
  });

  it('should reject an empty background natural-language job', async () => {
    await expect(
      queryService.enqueueNaturalLanguageQuery(
        'dataset-1',
        'workspace-1',
        'user-1',
        '   ',
      ),
    ).rejects.toThrow(
      'Question is required',
    );

    expect(
      analysisQueueMock.add,
    ).not.toHaveBeenCalled();
  });

  // ==========================================
  // BACKGROUND JOB STATUS
  // ==========================================

  it('should return analysis job status for the owning user and workspace', async () => {
    const job = {
      id:
        'job-42',

      data: {
        type:
          'sql',

        datasetIds: [
          'dataset-1',
        ],

        workspaceId:
          'workspace-1',

        userId:
          'user-1',

        sql:
          'SELECT * FROM dataset',
      },

      progress: {
        stage:
          'validating',

        percent:
          15,
      },

      attemptsMade:
        1,

      opts: {
        attempts:
          3,
      },

      timestamp:
        1_700_000_000_000,

      processedOn:
        1_700_000_001_000,

      finishedOn:
        undefined,

      failedReason:
        undefined,

      returnvalue:
        undefined,

      getState:
        vi.fn().mockResolvedValue(
          'active',
        ),
    };

    analysisQueueMock.getJob.mockResolvedValue(
      job,
    );

    const result =
      await queryService.getAnalysisJobStatus(
        'job-42',
        'workspace-1',
        'user-1',
      );

    expect(result).toEqual({
      jobId:
        'job-42',

      queue:
        'analysis',

      type:
        'sql',

      status:
        'active',

      progress: {
        stage:
          'validating',

        percent:
          15,
      },

      attemptsMade:
        1,

      maxAttempts:
        3,

      createdAt:
        new Date(
          1_700_000_000_000,
        ).toISOString(),

      processedAt:
        new Date(
          1_700_000_001_000,
        ).toISOString(),

      finishedAt:
        null,

      failedReason:
        null,

      result:
        null,
    });

    expect(
      analysisQueueMock.getJob,
    ).toHaveBeenCalledWith(
      'job-42',
    );
  });

  it('should not expose analysis jobs belonging to another user', async () => {
    const job = {
      id:
        'job-42',

      data: {
        type:
          'sql',

        datasetIds: [
          'dataset-1',
        ],

        workspaceId:
          'workspace-1',

        userId:
          'different-user',

        sql:
          'SELECT * FROM dataset',
      },

      getState:
        vi.fn().mockResolvedValue(
          'active',
        ),

      progress:
        0,

      attemptsMade:
        0,

      opts: {
        attempts:
          3,
      },

      timestamp:
        Date.now(),

      processedOn:
        undefined,

      finishedOn:
        undefined,

      failedReason:
        undefined,

      returnvalue:
        undefined,
    };

    analysisQueueMock.getJob.mockResolvedValue(
      job,
    );

    await expect(
      queryService.getAnalysisJobStatus(
        'job-42',
        'workspace-1',
        'user-1',
      ),
    ).rejects.toThrow(
      'Analysis job was not found for this workspace',
    );
  });

  // ==========================================
  // WORKER PROCESSING CONTRACT
  // ==========================================

  it('should process a SQL analysis job through the synchronous execution path', async () => {
    const expectedResult = {
      sql:
        'SELECT * FROM dataset',

      columns: [
        'city',
      ],

      rows: [
        ['Delhi'],
      ],

      rowCount:
        1,

      truncated:
        false,

      executionTimeMs:
        12,

      summary:
        defaultSummary,

      visualization:
        defaultVisualization,

      explanation:
        null,

      followUpQuestions:
        [],

      analytics:
        null,

      aiInsights:
        null,
    };

    const executeSqlSpy =
      vi.spyOn(
        queryService,
        'executeSql',
      ).mockResolvedValue(
        expectedResult,
      );

    const job = {
      data: {
        type:
          'sql',

        datasetIds: [
          'dataset-1',
        ],

        workspaceId:
          'workspace-1',

        userId:
          'user-1',

        sql:
          'SELECT * FROM dataset',

        conversationId:
          null,
      },

      updateProgress:
        vi.fn().mockResolvedValue(
          undefined,
        ),
    } as any;

    const result =
      await queryService.processAnalysisJob(
        job,
      );

    expect(
      result,
    ).toEqual(
      expectedResult,
    );

    expect(
      executeSqlSpy,
    ).toHaveBeenCalledWith(
      'dataset-1',
      'workspace-1',
      'user-1',
      'SELECT * FROM dataset',
      null,
      null,
    );

    expect(
      job.updateProgress,
    ).toHaveBeenCalledWith({
      stage:
        'started',

      percent:
        5,
    });

    expect(
      job.updateProgress,
    ).toHaveBeenCalledWith({
      stage:
        'completed',

      percent:
        100,
    });
  });

  it('should mark an analysis job as failed when processing throws', async () => {
    const executeSqlSpy =
      vi.spyOn(
        queryService,
        'executeSql',
      ).mockRejectedValue(
        new BadRequestException(
          'Query execution failed',
        ),
      );

    const job = {
      data: {
        type:
          'sql',

        datasetIds: [
          'dataset-1',
        ],

        workspaceId:
          'workspace-1',

        userId:
          'user-1',

        sql:
          'SELECT * FROM dataset',
      },

      updateProgress:
        vi.fn().mockResolvedValue(
          undefined,
        ),
    } as any;

    await expect(
      queryService.processAnalysisJob(
        job,
      ),
    ).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(
      executeSqlSpy,
    ).toHaveBeenCalled();

    expect(
      job.updateProgress,
    ).toHaveBeenCalledWith({
      stage:
        'failed',

      percent:
        100,
    });
  });
});
