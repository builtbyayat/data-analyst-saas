import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';

import {
  Queue,
} from 'bullmq';

import {
  Repository,
} from 'typeorm';

import { Dataset } from './dataset.entity.js';

import { StorageService } from '../storage/storage.service.js';

export interface DatasetAnalysisContext {
  dataset: {
    id: string;

    name: string;

    originalFilename: string;

    fileType: string;

    fileSize: string;

    rowCount: number;

    columnCount: number;

    status:
      | 'pending'
      | 'processing'
      | 'ready'
      | 'failed';
  };

  columns: Array<{
    name: string;

    dataType: string;

    ordinalPosition: number;

    nullable: boolean;

    nullCount: number;

    distinctCount: number;
  }>;
}

export interface UpdateDatasetInput {
  name?: string;
}

const DEFAULT_DATASET_LIST_LIMIT =
  50;

const MAX_DATASET_LIST_LIMIT =
  100;

const MAX_DATASET_NAME_LENGTH =
  200;

@Injectable()
export class DatasetsService {
  constructor(
    @InjectRepository(Dataset)
    private readonly datasetRepository:
      Repository<Dataset>,

    @InjectQueue('dataset_ingestion')
    private readonly ingestionQueue:
      Queue,

    private readonly storageService:
      StorageService,
  ) {}

  async findById(
    datasetId: string,
    workspaceId: string,
  ): Promise<Dataset> {
    const dataset =
      await this.datasetRepository.findOne({
        where: {
          id: datasetId,
          workspaceId,
        },

        relations: {
          columns: true,
        },
      });

    if (!dataset) {
      throw new NotFoundException(
        'Dataset not found',
      );
    }

    return dataset;
  }

  async findByContentHash(
    workspaceId: string,
    contentHash: string,
  ): Promise<Dataset | null> {
    const normalizedHash =
      this.normalizeContentHash(
        contentHash,
      );

    return this.datasetRepository.findOne({
      where: {
        workspaceId,
        contentHash: normalizedHash,
      },
    });
  }

  async getAnalysisContext(
    datasetId: string,
    workspaceId: string,
  ): Promise<DatasetAnalysisContext> {
    const dataset =
      await this.findById(
        datasetId,
        workspaceId,
      );

    if (
      dataset.status !==
      'ready'
    ) {
      throw new BadRequestException(
        `Dataset is not ready for analysis. Current status: ${dataset.status}`,
      );
    }

    if (
      !dataset.queryObjectKey
    ) {
      throw new BadRequestException(
        'Dataset does not have a queryable Parquet object',
      );
    }

    return {
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

      columns:
        [...dataset.columns]
          .sort(
            (a, b) =>
              a.ordinalPosition -
              b.ordinalPosition,
          )
          .map(
            (column) => ({
              name:
                column.name,

              dataType:
                column.dataType,

              ordinalPosition:
                column.ordinalPosition,

              nullable:
                column.nullable,

              nullCount:
                column.nullCount,

              distinctCount:
                column.distinctCount,
            }),
          ),
    };
  }

  async listByWorkspace(
    workspaceId: string,
    limit = DEFAULT_DATASET_LIST_LIMIT,
  ): Promise<Dataset[]> {
    const safeLimit =
      this.normalizeListLimit(
        limit,
      );

    return this.datasetRepository.find({
      where: {
        workspaceId,
      },

      order: {
        createdAt:
          'DESC',
      },

      take: safeLimit,
    });
  }

  async createDataset(
    workspaceId: string,
    name: string,
    originalFilename: string,
    objectKey: string,
    fileType: string,
    fileSize: string,
    contentHash:
      | string
      | null
      | undefined = null,
  ): Promise<Dataset> {
    const normalizedName =
      this.normalizeDatasetName(
        name,
      );

    const normalizedFileSize =
      this.normalizeFileSize(
        fileSize,
      );

    const normalizedContentHash =
      contentHash
        ? this.normalizeContentHash(
            contentHash,
          )
        : null;

    if (
      normalizedContentHash
    ) {
      const existing =
        await this.findByContentHash(
          workspaceId,
          normalizedContentHash,
        );

      if (existing) {
        throw new ConflictException({
          message:
            'This file is already uploaded to this workspace',

          code:
            'DUPLICATE_DATASET',

          datasetId:
            existing.id,

          datasetName:
            existing.name,

          originalFilename:
            existing.originalFilename,
        });
      }
    }

    const dataset =
      this.datasetRepository.create({
        workspaceId,

        name:
          normalizedName,

        originalFilename:
          originalFilename.trim(),

        objectKey,

        fileType,

        fileSize:
          normalizedFileSize.toString(),

        contentHash:
          normalizedContentHash,

        rowCount:
          0,

        columnCount:
          0,

        status:
          'pending',
      });

    try {
      const savedDataset =
        await this.datasetRepository.save(
          dataset,
        );

      try {
        await this.ingestionQueue.add(
          'process-dataset',
          {
            datasetId:
              savedDataset.id,

            workspaceId:
              savedDataset.workspaceId,
          },
        );
      } catch (
        error
      ) {
        try {
          await this.datasetRepository.delete({
            id:
              savedDataset.id,

            workspaceId,
          });
        } catch {
          // Preserve the original queue error.
        }

        throw error;
      }

      return savedDataset;
    } catch (
      error
    ) {
      /*
       * The unique index on
       * (workspaceId, contentHash)
       * is the final race-condition
       * protection.
       *
       * Two simultaneous uploads of
       * the same file may both pass the
       * pre-check, but only one can be
       * persisted successfully.
       */
      if (
        this.isDuplicateConstraintError(
          error,
        )
      ) {
        const existing =
          normalizedContentHash
            ? await this.findByContentHash(
                workspaceId,
                normalizedContentHash,
              )
            : null;

        throw new ConflictException({
          message:
            'This file is already uploaded to this workspace',

          code:
            'DUPLICATE_DATASET',

          datasetId:
            existing?.id,

          datasetName:
            existing?.name,

          originalFilename:
            existing?.originalFilename,
        });
      }

      throw error;
    }
  }

  async updateDataset(
    datasetId: string,
    workspaceId: string,
    input: UpdateDatasetInput,
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
        'Dataset not found',
      );
    }

    if (
      input.name !==
      undefined
    ) {
      dataset.name =
        this.normalizeDatasetName(
          input.name,
        );
    }

    return this.datasetRepository.save(
      dataset,
    );
  }

  async deleteDataset(
    datasetId: string,
    workspaceId: string,
  ): Promise<void> {
    const dataset =
      await this.datasetRepository.findOne({
        where: {
          id: datasetId,
          workspaceId,
        },
      });

    if (!dataset) {
      throw new NotFoundException(
        'Dataset not found',
      );
    }

    await this.storageService.delete(
      dataset.objectKey,
    );

    if (
      dataset.queryObjectKey
    ) {
      await this.storageService.delete(
        dataset.queryObjectKey,
      );
    }

    await this.datasetRepository.remove(
      dataset,
    );
  }

  private normalizeDatasetName(
    name: string,
  ): string {
    if (
      typeof name !==
      'string'
    ) {
      throw new BadRequestException(
        'Dataset name is required',
      );
    }

    const normalized =
      name.trim();

    if (!normalized) {
      throw new BadRequestException(
        'Dataset name is required',
      );
    }

    if (
      normalized.length >
      MAX_DATASET_NAME_LENGTH
    ) {
      throw new BadRequestException(
        `Dataset name must be ${MAX_DATASET_NAME_LENGTH} characters or fewer`,
      );
    }

    return normalized;
  }

  private normalizeFileSize(
    fileSize: string,
  ): number {
    if (
      typeof fileSize !==
      'string'
    ) {
      throw new BadRequestException(
        'Dataset file size is required',
      );
    }

    const normalized =
      fileSize.trim();

    const parsed =
      Number(normalized);

    if (
      !Number.isSafeInteger(
        parsed,
      ) ||
      parsed <= 0
    ) {
      throw new BadRequestException(
        'Dataset file size must be a valid positive integer',
      );
    }

    return parsed;
  }

  private normalizeContentHash(
    contentHash: string,
  ): string {
    if (
      typeof contentHash !==
      'string'
    ) {
      throw new BadRequestException(
        'Dataset content hash is required',
      );
    }

    const normalized =
      contentHash
        .trim()
        .toLowerCase();

    if (
      !/^[a-f0-9]{64}$/.test(
        normalized,
      )
    ) {
      throw new BadRequestException(
        'Dataset content hash must be a valid SHA-256 hash',
      );
    }

    return normalized;
  }

  private isDuplicateConstraintError(
    error: unknown,
  ): boolean {
    if (
      !error ||
      typeof error !==
        'object'
    ) {
      return false;
    }

    const databaseError =
      error as {
        code?: string;
        constraint?: string;
      };

    return (
      databaseError.code ===
        '23505' &&
      databaseError.constraint ===
        'IDX_datasets_workspace_content_hash'
    );
  }

  private normalizeListLimit(
    limit: number,
  ): number {
    if (
      !Number.isFinite(
        limit,
      )
    ) {
      return DEFAULT_DATASET_LIST_LIMIT;
    }

    const normalized =
      Math.floor(limit);

    if (
      normalized <= 0
    ) {
      return DEFAULT_DATASET_LIST_LIMIT;
    }

    return Math.min(
      normalized,
      MAX_DATASET_LIST_LIMIT,
    );
  }
}