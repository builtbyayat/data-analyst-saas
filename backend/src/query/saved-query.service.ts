import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';

import {
  FindOptionsWhere,
  Repository,
} from 'typeorm';

import { Dataset } from '../datasets/dataset.entity.js';

import { SqlValidatorService } from './sql-validator.service.js';

import { SavedQuery } from './saved-query.entity.js';

export interface CreateSavedQueryInput {
  title: string;

  description?: string | null;

  question?: string | null;

  sql: string;

  datasetId?: string | null;
}

export interface UpdateSavedQueryInput {
  title?: string;

  description?: string | null;

  question?: string | null;

  sql?: string;

  datasetId?: string | null;
}

export interface SavedQueryListItem {
  id: string;

  workspaceId: string;

  userId: string;

  datasetId: string | null;

  title: string;

  description: string | null;

  question: string | null;

  sql: string;

  createdAt: Date;

  updatedAt: Date;
}

@Injectable()
export class SavedQueryService {
  constructor(
    @InjectRepository(SavedQuery)
    private readonly savedQueryRepository:
      Repository<SavedQuery>,

    @InjectRepository(Dataset)
    private readonly datasetRepository:
      Repository<Dataset>,

    private readonly sqlValidatorService:
      SqlValidatorService,
  ) {}

  async createForUser(
    workspaceId: string,
    userId: string,
    input: CreateSavedQueryInput,
  ): Promise<SavedQueryListItem> {
    const title =
      this.normalizeTitle(
        input.title,
      );

    const sql =
      this.normalizeSql(
        input.sql,
      );

    /*
     * validate() throws BadRequestException when
     * the SQL is invalid.
     *
     * On success it simply returns the normalized SQL.
     *
     * We must NOT treat that return value as an error.
     */
    this.validateSql(sql);

    const datasetId =
      await this.resolveDatasetId(
        workspaceId,
        input.datasetId,
      );

    const savedQuery =
      this.savedQueryRepository.create({
        workspaceId,

        userId,

        datasetId,

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
      });

    const saved =
      await this.savedQueryRepository.save(
        savedQuery,
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
  ): Promise<SavedQueryListItem[]> {
    const safeLimit =
      Math.max(
        1,
        Math.min(
          Math.floor(limit),
          100,
        ),
      );

    const where:
      FindOptionsWhere<SavedQuery> = {
        workspaceId,

        userId,
      };

    if (datasetId) {
      where.datasetId =
        datasetId;
    }

    const savedQueries =
      await this.savedQueryRepository.find({
        where,

        order: {
          updatedAt: 'DESC',
        },

        take: safeLimit,
      });

    return savedQueries.map(
      (item) =>
        this.toListItem(item),
    );
  }

  async getForUser(
    workspaceId: string,
    userId: string,
    savedQueryId: string,
  ): Promise<SavedQueryListItem> {
    const savedQuery =
      await this.savedQueryRepository.findOne({
        where: {
          id: savedQueryId,

          workspaceId,

          userId,
        },
      });

    if (!savedQuery) {
      throw new NotFoundException(
        'Saved query not found',
      );
    }

    return this.toListItem(
      savedQuery,
    );
  }

  async updateForUser(
    workspaceId: string,
    userId: string,
    savedQueryId: string,
    input: UpdateSavedQueryInput,
  ): Promise<SavedQueryListItem> {
    const savedQuery =
      await this.savedQueryRepository.findOne({
        where: {
          id: savedQueryId,

          workspaceId,

          userId,
        },
      });

    if (!savedQuery) {
      throw new NotFoundException(
        'Saved query not found',
      );
    }

    if (
      input.title !==
      undefined
    ) {
      savedQuery.title =
        this.normalizeTitle(
          input.title,
        );
    }

    if (
      input.description !==
      undefined
    ) {
      savedQuery.description =
        this.normalizeOptionalText(
          input.description,
        );
    }

    if (
      input.question !==
      undefined
    ) {
      savedQuery.question =
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

      savedQuery.sql =
        sql;
    }

    if (
      input.datasetId !==
      undefined
    ) {
      savedQuery.datasetId =
        await this.resolveDatasetId(
          workspaceId,
          input.datasetId,
        );
    }

    const updated =
      await this.savedQueryRepository.save(
        savedQuery,
      );

    return this.toListItem(
      updated,
    );
  }

  async removeForUser(
    workspaceId: string,
    userId: string,
    savedQueryId: string,
  ): Promise<void> {
    const savedQuery =
      await this.savedQueryRepository.findOne({
        where: {
          id: savedQueryId,

          workspaceId,

          userId,
        },
      });

    if (!savedQuery) {
      throw new NotFoundException(
        'Saved query not found',
      );
    }

    await this.savedQueryRepository.remove(
      savedQuery,
    );
  }

  private async resolveDatasetId(
    workspaceId: string,
    datasetId:
      | string
      | null
      | undefined,
  ): Promise<string | null> {
    if (!datasetId) {
      return null;
    }

    const dataset =
      await this.datasetRepository.findOne({
        where: {
          id: datasetId,

          workspaceId,
        },
      });

    if (!dataset) {
      throw new BadRequestException(
        'Dataset does not belong to this workspace',
      );
    }

    return dataset.id;
  }

  private validateSql(
    sql: string,
  ): void {
    /*
     * SqlValidatorService.validate() throws when
     * validation fails.
     *
     * Therefore, there is nothing to inspect here.
     * A successful return means the SQL is valid.
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
        'Saved query title is required',
      );
    }

    const title =
      value.trim();

    if (!title) {
      throw new BadRequestException(
        'Saved query title is required',
      );
    }

    if (
      title.length >
      200
    ) {
      throw new BadRequestException(
        'Saved query title must be 200 characters or fewer',
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

  private toListItem(
    item: SavedQuery,
  ): SavedQueryListItem {
    return {
      id:
        item.id,

      workspaceId:
        item.workspaceId,

      userId:
        item.userId,

      datasetId:
        item.datasetId,

      title:
        item.title,

      description:
        item.description,

      question:
        item.question,

      sql:
        item.sql,

      createdAt:
        item.createdAt,

      updatedAt:
        item.updatedAt,
    };
  }
}