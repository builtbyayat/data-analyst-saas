import {
  BadRequestException,
} from '@nestjs/common';

import {
  Test,
  TestingModule,
} from '@nestjs/testing';

import {
  getRepositoryToken,
} from '@nestjs/typeorm';

import { vi } from 'vitest';

import { Dataset } from '../datasets/dataset.entity.js';
import { StorageService } from '../storage/storage.service.js';

import { DuckDBService } from './duckdb.service.js';
import { QueryHistory } from './query-history.entity.js';
import { QueryService } from './query.service.js';
import { SqlGenerationService } from './sql-generation.service.js';
import { SqlValidatorService } from './sql-validator.service.js';

describe('QueryService', () => {
  let queryService: QueryService;

  const datasetRepositoryMock = {
    findOne: vi.fn(),
  };

  const queryHistoryRepositoryMock = {
    create: vi.fn(),
    save: vi.fn(),
  };

  const storageServiceMock = {
    download: vi.fn(),
  };

  const duckDbServiceMock = {
    queryDataset: vi.fn(),
  };

  const sqlValidatorServiceMock = {
    validate: vi.fn(),
  };

  const sqlGenerationServiceMock = {
    generateSql: vi.fn(),
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

  beforeEach(async () => {
    vi.clearAllMocks();

    datasetRepositoryMock.findOne.mockResolvedValue(
      dataset,
    );

    queryHistoryRepositoryMock.create.mockImplementation(
      (value) => value,
    );

    queryHistoryRepositoryMock.save.mockResolvedValue(
      undefined,
    );

    storageServiceMock.download.mockResolvedValue(
      Buffer.from('test parquet data'),
    );

    duckDbServiceMock.queryDataset.mockResolvedValue(
      defaultQueryResult,
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

    const app: TestingModule =
      await Test.createTestingModule({
        providers: [
          QueryService,

          {
            provide:
              getRepositoryToken(Dataset),

            useValue:
              datasetRepositoryMock,
          },

          {
            provide:
              getRepositoryToken(QueryHistory),

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
        ],
      }).compile();

    queryService =
      app.get<QueryService>(
        QueryService,
      );
  });

  it('should execute a valid SQL query and return results', async () => {
    const result =
      await queryService.executeSql(
        'dataset-1',
        'workspace-1',
        'user-1',
        'SELECT city, SUM(sales) AS total_sales FROM dataset GROUP BY city',
      );

    expect(result).toEqual({
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
    });

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
    duckDbServiceMock.queryDataset.mockResolvedValue(
      {
        columns: [
          'city',
          'total_sales',
        ],

        rows: [],
      },
    );

    const result =
      await queryService.executeSql(
        'dataset-1',
        'workspace-1',
        'user-1',
        'SELECT city, SUM(sales) AS total_sales FROM dataset GROUP BY city',
      );

    expect(result).toEqual({
      columns: [
        'city',
        'total_sales',
      ],

      rows: [],

      rowCount: 0,

      truncated: false,

      executionTimeMs:
        expect.any(Number),
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

    duckDbServiceMock.queryDataset.mockResolvedValue(
      {
        columns: [
          'city',
          'total_sales',
        ],

        rows,
      },
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

    expect(
      queryHistoryRepositoryMock.create,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        status:
          'success',

        failureType:
          null,

        rowCount:
          5000,
      }),
    );
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
      },
    });
  });
});