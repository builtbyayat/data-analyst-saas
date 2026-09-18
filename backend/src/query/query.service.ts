import {
  BadRequestException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  mkdtemp,
  rm,
  writeFile,
} from 'node:fs/promises';

import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Dataset } from '../datasets/dataset.entity.js';
import { StorageService } from '../storage/storage.service.js';

import { DuckDBService } from './duckdb.service.js';
import { QueryHistory } from './query-history.entity.js';
import { ResultSummaryService } from './result-summary.service.js';
import {
  ResultVisualization,
  ResultVisualizationService,
} from './result-visualization.service.js';
import {
  SqlExplanationResult,
  SqlExplanationService,
} from './sql-explanation.service.js';
import { SqlGenerationService } from './sql-generation.service.js';
import { SqlValidatorService } from './sql-validator.service.js';

export interface DatasetQueryResult {
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

  explanation:
    | SqlExplanationResult
    | null;
}

export interface NaturalLanguageQueryResult {
  question: string;

  sql: string;

  provider: string;

  model: string | null;

  result: DatasetQueryResult;
}

@Injectable()
export class QueryService {
  private readonly maxResultRows =
    5000;

  constructor(
    @InjectRepository(Dataset)
    private readonly datasetRepository: Repository<Dataset>,

    @InjectRepository(QueryHistory)
    private readonly queryHistoryRepository: Repository<QueryHistory>,

    private readonly storageService: StorageService,

    private readonly duckDbService: DuckDBService,

    private readonly sqlValidatorService: SqlValidatorService,

    private readonly sqlGenerationService: SqlGenerationService,

    private readonly resultSummaryService: ResultSummaryService,

    private readonly resultVisualizationService: ResultVisualizationService,

    private readonly sqlExplanationService: SqlExplanationService,
  ) {}

  private async getDataset(
    datasetId: string,
    workspaceId: string,
  ): Promise<Dataset> {
    const dataset =
      await this.datasetRepository.findOne({
        where: {
          id: datasetId,

          workspaceId,
        },
      });

    if (!dataset) {
      throw new NotFoundException(
        'Dataset was not found for this workspace',
      );
    }

    if (!dataset.queryObjectKey) {
      throw new BadRequestException(
        'Dataset does not have a queryable Parquet object',
      );
    }

    return dataset;
  }

  private normalizeQueryError(
    error: unknown,
  ): HttpException {
    if (
      error instanceof HttpException
    ) {
      return error;
    }

    return new BadRequestException(
      'Query execution failed',
    );
  }

  private getErrorMessage(
    error: unknown,
  ): string {
    if (error instanceof Error) {
      return error.message.slice(
        0,
        4000,
      );
    }

    return 'Unknown query execution error';
  }

  private async executeAgainstDataset(
    dataset: Dataset,
    sql: string,
    question?: string | null,
  ): Promise<DatasetQueryResult> {
    const startedAt =
      Date.now();

    const parquetBuffer =
      await this.storageService.download(
        dataset.queryObjectKey!,
      );

    const tempDirectory =
      await mkdtemp(
        join(
          tmpdir(),
          'dataset-query-',
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

      const limitedSql = `
        SELECT *
        FROM (
          ${sql}
        ) AS user_query
        LIMIT ${this.maxResultRows + 1}
      `;

      const result =
        await this.duckDbService.queryDataset(
          parquetPath,
          limitedSql,
        );

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
          question,
        );

      const explanation =
        question?.trim()
          ? await this.sqlExplanationService.explain(
              {
                sql,

                question,

                columns:
                  result.columns,

                rowCount:
                  rows.length,

                truncated,

                summary,
              },
            )
          : null;

      return {
        sql,

        columns:
          result.columns,

        rows,

        rowCount:
          rows.length,

        truncated,

        executionTimeMs:
          Date.now() -
          startedAt,

        summary,

        visualization,

        explanation,
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
  }

  async previewDataset(
    datasetId: string,
    workspaceId: string,
    limit = 100,
  ): Promise<DatasetQueryResult> {
    try {
      const dataset =
        await this.getDataset(
          datasetId,
          workspaceId,
        );

      const safeLimit =
        Math.max(
          1,
          Math.min(
            Math.floor(limit),
            1000,
          ),
        );

      const previewSql = `
        SELECT *
        FROM dataset
        LIMIT ${safeLimit}
      `;

      return await this.executeAgainstDataset(
        dataset,
        previewSql,
      );
    } catch (error) {
      throw this.normalizeQueryError(
        error,
      );
    }
  }

  async executeSql(
    datasetId: string,
    workspaceId: string,
    userId: string,
    sql: string,
    question?: string | null,
  ): Promise<DatasetQueryResult> {
    const startedAt =
      Date.now();

    let failureType:
      | 'validation'
      | 'execution'
      | null = 'validation';

    try {
      const dataset =
        await this.getDataset(
          datasetId,
          workspaceId,
        );

      const validatedSql =
        this.sqlValidatorService.validate(
          sql,
        );

      failureType =
        'execution';

      const result =
        await this.executeAgainstDataset(
          dataset,
          validatedSql,
          question,
        );

      await this.queryHistoryRepository.save(
        this.queryHistoryRepository.create({
          workspaceId,

          datasetId,

          userId,

          sql:
            validatedSql,

          rowCount:
            result.rowCount,

          executionTimeMs:
            result.executionTimeMs,

          status:
            'success',

          failureType:
            null,

          errorMessage:
            null,
        }),
      );

      return result;
    } catch (error) {
      const executionTimeMs =
        Date.now() -
        startedAt;

      await this.queryHistoryRepository.save(
        this.queryHistoryRepository.create({
          workspaceId,

          datasetId,

          userId,

          sql,

          rowCount:
            null,

          executionTimeMs,

          status:
            'failed',

          failureType,

          errorMessage:
            this.getErrorMessage(
              error,
            ),
        }),
      );

      throw this.normalizeQueryError(
        error,
      );
    }
  }

  async executeNaturalLanguageQuery(
    datasetId: string,
    workspaceId: string,
    userId: string,
    question: string,
  ): Promise<NaturalLanguageQueryResult> {
    const generation =
      await this.sqlGenerationService.generateSql(
        datasetId,
        workspaceId,
        question,
      );

    const result =
      await this.executeSql(
        datasetId,
        workspaceId,
        userId,
        generation.sql,
        generation.question,
      );

    return {
      question:
        generation.question,

      sql:
        generation.sql,

      provider:
        generation.provider,

      model:
        generation.model,

      result,
    };
  }
}