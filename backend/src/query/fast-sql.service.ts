import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';

import {
  mkdtemp,
  rm,
  writeFile,
} from 'node:fs/promises';

import { tmpdir } from 'node:os';

import { join } from 'node:path';

import {
  Repository,
} from 'typeorm';

import { QueryHistory } from './query-history.entity.js';

import {
  DuckDBQueryError,
  DuckDBService,
} from './duckdb.service.js';

import {
  ResultSummaryService,
} from './result-summary.service.js';

import {
  ResultVisualization,
  ResultVisualizationService,
} from './result-visualization.service.js';

import { SqlValidatorService } from './sql-validator.service.js';

import { DatasetsService } from '../datasets/datasets.service.js';

import { StorageService } from '../storage/storage.service.js';

import {
  PlanUsageService,
} from '../billing/plan-usage.service.js';

export interface FastSqlQueryResult {
  sql: string;

  columns: string[];

  rows: unknown[][];

  rowCount: number;

  truncated: boolean;

  executionTimeMs: number;

  summary: {
    totalRows: number;

    numericColumns: Array<{
      column: string;

      sum: number;

      average: number;

      min: number;

      max: number;
    }>;
  };

  visualization: ResultVisualization;

  explanation: null;

  aiInsights: null;

  analytics: null;

  followUpQuestions: string[];
}

@Injectable()
export class FastSqlService {
  private readonly maxResultRows =
    5000;

  constructor(
    @InjectRepository(
      QueryHistory,
    )
    private readonly queryHistoryRepository:
      Repository<QueryHistory>,

    private readonly datasetsService:
      DatasetsService,

    private readonly storageService:
      StorageService,

    private readonly duckDbService:
      DuckDBService,

    private readonly sqlValidatorService:
      SqlValidatorService,

    private readonly resultSummaryService:
      ResultSummaryService,

    private readonly resultVisualizationService:
      ResultVisualizationService,

    private readonly planUsageService:
      PlanUsageService,
  ) {}

  async execute(
    datasetId: string,

    workspaceId: string,

    userId: string,

    sql: string,

    question?: string | null,

    conversationId?: string | null,
  ): Promise<FastSqlQueryResult> {
    const startedAt =
      Date.now();

    let failureType:
      | 'validation'
      | 'execution' = 'validation';

    const normalizedSql =
      this.normalizeSql(
        sql,
      );

    /*
     * Consume one SQL execution before running the query.
     *
     * This keeps the quota enforced even when the actual
     * query later fails.
     */
    await this.planUsageService.consumeSqlExecution(
      workspaceId,
    );

    try {
      const dataset =
        await this.datasetsService.findById(
          datasetId,
          workspaceId,
        );

      if (
        !dataset.queryObjectKey
      ) {
        throw new BadRequestException(
          'Dataset is not ready for SQL execution',
        );
      }

      const validatedSql =
        this.sqlValidatorService.validate(
          normalizedSql,
        );

      failureType =
        'execution';

      const parquetBuffer =
        await this.storageService.download(
          dataset.queryObjectKey,
        );

      const tempDirectory =
        await mkdtemp(
          join(
            tmpdir(),
            'fast-dataset-query-',
          ),
        );

      const parquetPath =
        join(
          tempDirectory,
          'dataset.parquet',
        );

      try {
        await writeFile(
          parquetPath,
          parquetBuffer,
        );

        const queryStartedAt =
          Date.now();

        const result =
          await this.duckDbService.queryDataset(
            parquetPath,
            validatedSql,
          );

        const executionTimeMs =
          Date.now() -
          queryStartedAt;

        const truncated =
          result.rows.length >
          this.maxResultRows;

        const rows =
          truncated
            ? result.rows.slice(
                0,
                this.maxResultRows,
              )
            : result.rows;

        const summary =
          this.resultSummaryService.summarize(
            result.columns,
            rows,
          );

        const visualization =
          this.resultVisualizationService.analyze(
            result.columns,
            rows,
            question?.trim() ||
              null,
          );

        const totalRequestTimeMs =
          Date.now() -
          startedAt;

        await this.saveHistory(
          {
            workspaceId,

            datasetId,

            userId,

            conversationId:
              conversationId?.trim() ||
              null,

            question:
              question?.trim() ||
              null,

            sql:
              validatedSql,

            rowCount:
              rows.length,

            executionTimeMs:
              totalRequestTimeMs,

            status:
              'success',

            failureType:
              null,

            errorMessage:
              null,
          },
        );

        return {
          sql:
            validatedSql,

          columns:
            result.columns,

          rows,

          rowCount:
            rows.length,

          truncated,

          /*
           * For the UI this represents the actual
           * DuckDB execution time, not AI enrichment.
           */
          executionTimeMs,

          summary,

          visualization,

          explanation:
            null,

          aiInsights:
            null,

          analytics:
            null,

          followUpQuestions:
            [],
        };
      } finally {
        await rm(
          tempDirectory,
          {
            recursive: true,

            force: true,
          },
        );
      }
    } catch (
      error
    ) {
      const requestTimeMs =
        Date.now() -
        startedAt;

      await this.saveHistory(
        {
          workspaceId,

          datasetId,

          userId,

          conversationId:
            conversationId?.trim() ||
            null,

          question:
            question?.trim() ||
            null,

          sql:
            normalizedSql,

          rowCount:
            null,

          executionTimeMs:
            requestTimeMs,

          status:
            'failed',

          failureType,

          errorMessage:
            this.getErrorMessage(
              error,
            ),
        },
      );

      throw this.normalizeError(
        error,
      );
    }
  }

  private normalizeSql(
    sql: string,
  ): string {
    if (
      typeof sql !==
      'string'
    ) {
      throw new BadRequestException(
        'SQL query is required',
      );
    }

    const normalized =
      sql.trim();

    if (!normalized) {
      throw new BadRequestException(
        'SQL query is required',
      );
    }

    if (
      normalized.length >
      100_000
    ) {
      throw new BadRequestException(
        'SQL query is too long',
      );
    }

    return normalized;
  }

  private async saveHistory(
    input: {
      workspaceId: string;

      datasetId: string;

      userId: string;

      conversationId:
        | string
        | null;

      question:
        | string
        | null;

      sql: string;

      rowCount:
        | number
        | null;

      executionTimeMs:
        | number
        | null;

      status:
        | 'success'
        | 'failed';

      failureType:
        | 'validation'
        | 'execution'
        | null;

      errorMessage:
        | string
        | null;
    },
  ): Promise<void> {
    try {
      await this.queryHistoryRepository.save(
        this.queryHistoryRepository.create(
          input,
        ),
      );
    } catch {
      /*
       * History persistence must never hide the
       * actual query result/error.
       */
    }
  }

  private getErrorMessage(
    error: unknown,
  ): string {
    if (
      error instanceof Error
    ) {
      return error.message.slice(
        0,
        4000,
      );
    }

    return 'Query execution failed';
  }

  private normalizeError(
    error: unknown,
  ): Error {
    if (
      error instanceof
      BadRequestException
    ) {
      return error;
    }

    if (
      error instanceof
      DuckDBQueryError
    ) {
      return new BadRequestException({
        code:
          error.code,

        message:
          error.message,

        line:
          error.line,

        column:
          error.column,
      });
    }

    if (
      error instanceof
      NotFoundException
    ) {
      return error;
    }

    return new BadRequestException(
      'Query execution failed',
    );
  }
}