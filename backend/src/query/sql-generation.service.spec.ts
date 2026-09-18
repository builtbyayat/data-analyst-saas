import {
  BadRequestException,
} from '@nestjs/common';

import {
  Test,
  TestingModule,
} from '@nestjs/testing';

import { vi } from 'vitest';

import { AiService } from '../ai/ai.service.js';
import {
  DatasetAnalysisContext,
  DatasetsService,
} from '../datasets/datasets.service.js';

import { SqlGenerationService } from './sql-generation.service.js';
import { SqlValidatorService } from './sql-validator.service.js';

describe('SqlGenerationService', () => {
  let sqlGenerationService: SqlGenerationService;

  const datasetContext: DatasetAnalysisContext = {
    dataset: {
      id: 'dataset-1',
      name: 'Sales Dataset',
      originalFilename: 'sales.csv',
      fileType: 'text/csv',
      fileSize: '1000',
      rowCount: 3,
      columnCount: 4,
      status: 'ready',
    },

    columns: [
      {
        name: 'name',
        dataType: 'string',
        ordinalPosition: 0,
        nullable: false,
        nullCount: 0,
        distinctCount: 3,
      },
      {
        name: 'age',
        dataType: 'integer',
        ordinalPosition: 1,
        nullable: false,
        nullCount: 0,
        distinctCount: 3,
      },
      {
        name: 'city',
        dataType: 'string',
        ordinalPosition: 2,
        nullable: false,
        nullCount: 0,
        distinctCount: 3,
      },
      {
        name: 'sales',
        dataType: 'integer',
        ordinalPosition: 3,
        nullable: false,
        nullCount: 0,
        distinctCount: 3,
      },
    ],
  };

  const aiServiceMock = {
    generateText:
      vi.fn(),
  };

  const datasetsServiceMock = {
    getAnalysisContext:
      vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    datasetsServiceMock.getAnalysisContext.mockResolvedValue(
      datasetContext,
    );

    aiServiceMock.generateText.mockResolvedValue(
      {
        text:
          'SELECT city, SUM(sales) AS total_sales FROM dataset GROUP BY city',
        provider: 'test-provider',
        model: 'test-model',
        inputTokens: null,
        outputTokens: null,
      },
    );

    const app: TestingModule =
      await Test.createTestingModule({
        providers: [
          SqlGenerationService,
          SqlValidatorService,
          {
            provide: AiService,
            useValue: aiServiceMock,
          },
          {
            provide: DatasetsService,
            useValue:
              datasetsServiceMock,
          },
        ],
      }).compile();

    sqlGenerationService =
      app.get<SqlGenerationService>(
        SqlGenerationService,
      );
  });

  it('should generate and validate SQL using dataset context', async () => {
    const result =
      await sqlGenerationService.generateSql(
        'dataset-1',
        'workspace-1',
        'Show total sales by city',
      );

    expect(
      datasetsServiceMock.getAnalysisContext,
    ).toHaveBeenCalledWith(
      'dataset-1',
      'workspace-1',
    );

    expect(
      aiServiceMock.generateText,
    ).toHaveBeenCalledTimes(1);

    const request =
      aiServiceMock.generateText.mock
        .calls[0]?.[0];

    expect(
      request.systemPrompt,
    ).toContain(
      'read-only SQL query',
    );

    expect(
      request.userPrompt,
    ).toContain(
      'sales | type=integer',
    );

    expect(
      request.userPrompt,
    ).toContain(
      'city | type=string',
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
    });
  });

  it('should normalize SQL returned inside a Markdown code fence', async () => {
    aiServiceMock.generateText.mockResolvedValue(
      {
        text:
          '```sql\nSELECT city, SUM(sales) AS total_sales FROM dataset GROUP BY city\n```',
        provider: 'test-provider',
        model: 'test-model',
        inputTokens: null,
        outputTokens: null,
      },
    );

    const result =
      await sqlGenerationService.generateSql(
        'dataset-1',
        'workspace-1',
        'Show total sales by city',
      );

    expect(result.sql).toBe(
      'SELECT city, SUM(sales) AS total_sales FROM dataset GROUP BY city',
    );
  });

  it('should normalize an SQL prefix returned by the AI provider', async () => {
    aiServiceMock.generateText.mockResolvedValue(
      {
        text:
          'SQL: SELECT city, SUM(sales) AS total_sales FROM dataset GROUP BY city',
        provider: 'test-provider',
        model: 'test-model',
        inputTokens: null,
        outputTokens: null,
      },
    );

    const result =
      await sqlGenerationService.generateSql(
        'dataset-1',
        'workspace-1',
        'Show total sales by city',
      );

    expect(result.sql).toBe(
      'SELECT city, SUM(sales) AS total_sales FROM dataset GROUP BY city',
    );
  });

  it('should reject an empty natural-language question', async () => {
    await expect(
      sqlGenerationService.generateSql(
        'dataset-1',
        'workspace-1',
        '   ',
      ),
    ).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(
      datasetsServiceMock.getAnalysisContext,
    ).not.toHaveBeenCalled();

    expect(
      aiServiceMock.generateText,
    ).not.toHaveBeenCalled();
  });

  it('should reject an overlong natural-language question', async () => {
    const longQuestion =
      'a'.repeat(4001);

    await expect(
      sqlGenerationService.generateSql(
        'dataset-1',
        'workspace-1',
        longQuestion,
      ),
    ).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(
      datasetsServiceMock.getAnalysisContext,
    ).not.toHaveBeenCalled();

    expect(
      aiServiceMock.generateText,
    ).not.toHaveBeenCalled();
  });

  it('should reject SQL returned by the AI provider when validation fails', async () => {
    aiServiceMock.generateText.mockResolvedValue(
      {
        text:
          "SELECT * FROM read_parquet('/tmp/secret.parquet')",
        provider: 'test-provider',
        model: 'test-model',
        inputTokens: null,
        outputTokens: null,
      },
    );

    await expect(
      sqlGenerationService.generateSql(
        'dataset-1',
        'workspace-1',
        'Read a parquet file',
      ),
    ).rejects.toThrow(
      'SQL function is not allowed: READ_PARQUET',
    );
  });
});