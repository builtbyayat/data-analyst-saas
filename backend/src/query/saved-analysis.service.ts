import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';

import {
  FindOptionsWhere,
  In,
  Repository,
} from 'typeorm';

import { Dataset } from '../datasets/dataset.entity.js';

import { SqlValidatorService } from './sql-validator.service.js';

import { SavedAnalysis } from './saved-analysis.entity.js';

export interface CreateSavedAnalysisInput {
  title: string;

  description?: string | null;

  question?: string | null;

  sql: string;

  datasetIds: string[];

  resultSnapshot: Record<
    string,
    unknown
  >;
}

export interface UpdateSavedAnalysisInput {
  title?: string;

  description?: string | null;

  question?: string | null;

  sql?: string;

  datasetIds?: string[];

  resultSnapshot?: Record<
    string,
    unknown
  >;
}

export interface SavedAnalysisListItem {
  id: string;

  workspaceId: string;

  userId: string;

  datasetIds: string[];

  title: string;

  description: string | null;

  question: string | null;

  sql: string;

  resultSnapshot: Record<
    string,
    unknown
  >;

  createdAt: Date;

  updatedAt: Date;
}

@Injectable()
export class SavedAnalysisService {
  constructor(
    @InjectRepository(SavedAnalysis)
    private readonly savedAnalysisRepository:
      Repository<SavedAnalysis>,

    @InjectRepository(Dataset)
    private readonly datasetRepository:
      Repository<Dataset>,

    private readonly sqlValidatorService:
      SqlValidatorService,
  ) {}

  async createForUser(
    workspaceId: string,
    userId: string,
    input: CreateSavedAnalysisInput,
  ): Promise<SavedAnalysisListItem> {
    const title =
      this.normalizeTitle(
        input.title,
      );

    const sql =
      this.normalizeSql(
        input.sql,
      );

    /*
     * SqlValidatorService.validate()
     * throws BadRequestException when
     * SQL is invalid.
     *
     * On success it returns the
     * normalized SQL string.
     *
     * Therefore we only need to call
     * it here. We must NOT treat the
     * returned SQL string as an error.
     */
    this.validateSql(sql);

    const datasetIds =
      await this.resolveDatasetIds(
        workspaceId,
        input.datasetIds,
      );

    const resultSnapshot =
      this.normalizeResultSnapshot(
        input.resultSnapshot,
      );

    const savedAnalysis =
      this.savedAnalysisRepository.create({
        workspaceId,

        userId,

        datasetIds,

        title,

        description:
          this.normalizeOptionalText(
            input.description,
          ),

        question:
          this.normalizeOptionalText(
            input.question,
          ),

        sql,

        resultSnapshot,
      });

    const saved =
      await this.savedAnalysisRepository.save(
        savedAnalysis,
      );

    return this.toListItem(
      saved,
    );
  }

  async listForUser(
    workspaceId: string,
    userId: string,
    datasetId?: string,
    limit = 50,
  ): Promise<SavedAnalysisListItem[]> {
    const safeLimit =
      Math.max(
        1,
        Math.min(
          Math.floor(limit),
          100,
        ),
      );

    const where:
      FindOptionsWhere<SavedAnalysis> = {
        workspaceId,

        userId,
      };

    const savedAnalyses =
      await this.savedAnalysisRepository.find({
        where,

        order: {
          updatedAt: 'DESC',
        },

        take: safeLimit,
      });

    const filtered =
      datasetId
        ? savedAnalyses.filter(
            (item) =>
              item.datasetIds.includes(
                datasetId,
              ),
          )
        : savedAnalyses;

    return filtered.map(
      (item) =>
        this.toListItem(
          item,
        ),
    );
  }

  async getForUser(
    workspaceId: string,
    userId: string,
    savedAnalysisId: string,
  ): Promise<SavedAnalysisListItem> {
    const savedAnalysis =
      await this.savedAnalysisRepository.findOne({
        where: {
          id: savedAnalysisId,

          workspaceId,

          userId,
        },
      });

    if (!savedAnalysis) {
      throw new NotFoundException(
        'Saved analysis not found',
      );
    }

    return this.toListItem(
      savedAnalysis,
    );
  }

  async updateForUser(
    workspaceId: string,
    userId: string,
    savedAnalysisId: string,
    input: UpdateSavedAnalysisInput,
  ): Promise<SavedAnalysisListItem> {
    const savedAnalysis =
      await this.savedAnalysisRepository.findOne({
        where: {
          id: savedAnalysisId,

          workspaceId,

          userId,
        },
      });

    if (!savedAnalysis) {
      throw new NotFoundException(
        'Saved analysis not found',
      );
    }

    if (
      input.title !==
      undefined
    ) {
      savedAnalysis.title =
        this.normalizeTitle(
          input.title,
        );
    }

    if (
      input.description !==
      undefined
    ) {
      savedAnalysis.description =
        this.normalizeOptionalText(
          input.description,
        );
    }

    if (
      input.question !==
      undefined
    ) {
      savedAnalysis.question =
        this.normalizeOptionalText(
          input.question,
        );
    }

    if (
      input.sql !==
      undefined
    ) {
      const sql =
        this.normalizeSql(
          input.sql,
        );

      this.validateSql(sql);

      savedAnalysis.sql =
        sql;
    }

    if (
      input.datasetIds !==
      undefined
    ) {
      savedAnalysis.datasetIds =
        await this.resolveDatasetIds(
          workspaceId,
          input.datasetIds,
        );
    }

    if (
      input.resultSnapshot !==
      undefined
    ) {
      savedAnalysis.resultSnapshot =
        this.normalizeResultSnapshot(
          input.resultSnapshot,
        );
    }

    const updated =
      await this.savedAnalysisRepository.save(
        savedAnalysis,
      );

    return this.toListItem(
      updated,
    );
  }

  async removeForUser(
    workspaceId: string,
    userId: string,
    savedAnalysisId: string,
  ): Promise<void> {
    const savedAnalysis =
      await this.savedAnalysisRepository.findOne({
        where: {
          id: savedAnalysisId,

          workspaceId,

          userId,
        },
      });

    if (!savedAnalysis) {
      throw new NotFoundException(
        'Saved analysis not found',
      );
    }

    await this.savedAnalysisRepository.remove(
      savedAnalysis,
    );
  }

  private async resolveDatasetIds(
    workspaceId: string,
    datasetIds: string[],
  ): Promise<string[]> {
    if (
      !Array.isArray(
        datasetIds,
      )
    ) {
      throw new BadRequestException(
        'datasetIds must be an array',
      );
    }

    const normalized =
      Array.from(
        new Set(
          datasetIds
            .filter(
              (
                datasetId,
              ): datasetId is string =>
                typeof datasetId ===
                  'string' &&
                datasetId.trim()
                  .length > 0,
            )
            .map(
              (
                datasetId,
              ) =>
                datasetId.trim(),
            ),
        ),
      );

    if (
      normalized.length <
      1
    ) {
      throw new BadRequestException(
        'At least one dataset ID is required',
      );
    }

    const datasets =
      await this.datasetRepository.find({
        where: {
          workspaceId,

          id: In(
            normalized,
          ),
        },
      });

    if (
      datasets.length !==
      normalized.length
    ) {
      throw new BadRequestException(
        'One or more datasets do not belong to this workspace',
      );
    }

    const datasetIdSet =
      new Set(
        datasets.map(
          (dataset) =>
            dataset.id,
        ),
      );

    return normalized.filter(
      (datasetId) =>
        datasetIdSet.has(
          datasetId,
        ),
    );
  }

  private validateSql(
    sql: string,
  ): void {
    /*
     * The validator throws a
     * BadRequestException itself
     * whenever the SQL is invalid.
     *
     * A successful return means
     * the SQL is valid.
     */
    this.sqlValidatorService.validate(
      sql,
    );
  }

  private normalizeTitle(
    value: string,
  ): string {
    if (
      typeof value !==
      'string'
    ) {
      throw new BadRequestException(
        'Saved analysis title is required',
      );
    }

    const title =
      value.trim();

    if (!title) {
      throw new BadRequestException(
        'Saved analysis title is required',
      );
    }

    if (
      title.length >
      200
    ) {
      throw new BadRequestException(
        'Saved analysis title must be 200 characters or fewer',
      );
    }

    return title;
  }

  private normalizeSql(
    value: string,
  ): string {
    if (
      typeof value !==
      'string'
    ) {
      throw new BadRequestException(
        'SQL query is required',
      );
    }

    const sql =
      value.trim();

    if (!sql) {
      throw new BadRequestException(
        'SQL query is required',
      );
    }

    return sql;
  }

  private normalizeOptionalText(
    value:
      | string
      | null
      | undefined,
  ): string | null {
    if (
      value ===
        null ||
      value ===
        undefined
    ) {
      return null;
    }

    if (
      typeof value !==
      'string'
    ) {
      throw new BadRequestException(
        'Text fields must be strings',
      );
    }

    const normalized =
      value.trim();

    return (
      normalized || null
    );
  }

  private normalizeResultSnapshot(
    value: Record<
      string,
      unknown
    >,
  ): Record<
    string,
    unknown
  > {
    if (
      !value ||
      typeof value !==
        'object' ||
      Array.isArray(value)
    ) {
      throw new BadRequestException(
        'Result snapshot must be an object',
      );
    }

    try {
      const serialized =
        JSON.stringify(
          value,
        );

      if (
        serialized ===
        undefined
      ) {
        throw new Error(
          'Snapshot could not be serialized',
        );
      }

      JSON.parse(
        serialized,
      );
    } catch {
      throw new BadRequestException(
        'Result snapshot contains unsupported data',
      );
    }

    return value;
  }

  private toListItem(
    item: SavedAnalysis,
  ): SavedAnalysisListItem {
    return {
      id:
        item.id,

      workspaceId:
        item.workspaceId,

      userId:
        item.userId,

      datasetIds: [
        ...item.datasetIds,
      ],

      title:
        item.title,

      description:
        item.description,

      question:
        item.question,

      sql:
        item.sql,

      resultSnapshot:
        item.resultSnapshot,

      createdAt:
        item.createdAt,

      updatedAt:
        item.updatedAt,
    };
  }
}