import {
  BadRequestException,
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
import { SqlValidatorService } from './sql-validator.service.js';

export interface DatasetQueryResult {
  columns: string[];
  rows: unknown[][];
  rowCount: number;
  executionTimeMs: number;
}

@Injectable()
export class QueryService {
  constructor(
    @InjectRepository(Dataset)
    private readonly datasetRepository: Repository<Dataset>,

    private readonly storageService: StorageService,

    private readonly duckDbService: DuckDBService,

    private readonly sqlValidatorService: SqlValidatorService,
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

  private async executeAgainstDataset(
    dataset: Dataset,
    sql: string,
  ): Promise<DatasetQueryResult> {
    const startedAt = Date.now();

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

      const duckDbPath =
        parquetPath.replace(
          /\\/g,
          '/',
        );

      const escapedPath =
        duckDbPath.replace(
          /'/g,
          "''",
        );

      await this.duckDbService.query(`
        CREATE OR REPLACE TEMP VIEW dataset AS
        SELECT *
        FROM read_parquet(
          '${escapedPath}'
        )
      `);

      const result =
        await this.duckDbService.query(
          sql,
        );

      return {
        columns:
          result.columns,

        rows:
          result.rows,

        rowCount:
          result.rows.length,

        executionTimeMs:
          Date.now() - startedAt,
      };
    } finally {
      await this.duckDbService.query(`
        DROP VIEW IF EXISTS dataset
      `);

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

    return this.executeAgainstDataset(
      dataset,
      `
        SELECT *
        FROM dataset
        LIMIT ${safeLimit}
      `,
    );
  }

  async executeSql(
    datasetId: string,
    workspaceId: string,
    sql: string,
  ): Promise<DatasetQueryResult> {
    const dataset =
      await this.getDataset(
        datasetId,
        workspaceId,
      );

    const validatedSql =
      this.sqlValidatorService.validate(
        sql,
      );

    return this.executeAgainstDataset(
      dataset,
      validatedSql,
    );
  }
}