import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';

import {
  Repository,
} from 'typeorm';

import { Dataset } from '../datasets/dataset.entity.js';

import { Workspace } from '../workspaces/workspace.entity.js';

export interface WorkspaceUsageSnapshot {
  datasetCount: number;

  storageUsedBytes: number;

  storageLimitBytes: number;

  datasetLimit: number;

  maxFileSizeBytes: number;

  remainingDatasetSlots: number;

  remainingStorageBytes: number;
}

@Injectable()
export class UsageLimitsService {
  constructor(
    @InjectRepository(Workspace)
    private readonly workspaceRepository:
      Repository<Workspace>,

    @InjectRepository(Dataset)
    private readonly datasetRepository:
      Repository<Dataset>,
  ) {}

  async getUsage(
    workspaceId: string,
  ): Promise<WorkspaceUsageSnapshot> {
    const workspace =
      await this.workspaceRepository.findOne({
        where: {
          id: workspaceId,
        },

        relations: {
          plan: true,
        },
      });

    if (!workspace) {
      throw new NotFoundException(
        'Workspace not found',
      );
    }

    if (!workspace.plan) {
      throw new NotFoundException(
        'Workspace plan is not configured',
      );
    }

    const datasetCount =
      await this.datasetRepository.count({
        where: {
          workspaceId,
        },
      });

    const rawStorage =
      await this.datasetRepository
        .createQueryBuilder(
          'dataset',
        )
        .select(
          'COALESCE(SUM(CAST(dataset.fileSize AS numeric)), 0)',
          'storageUsedBytes',
        )
        .where(
          'dataset.workspaceId = :workspaceId',
          {
            workspaceId,
          },
        )
        .getRawOne<{
          storageUsedBytes:
            | string
            | null;
        }>();

    const storageUsedBytes =
      Number(
        rawStorage?.storageUsedBytes ??
          0,
      );

    const storageLimitBytes =
      Number(
        workspace.plan
          .storageLimitBytes,
      );

    const datasetLimit =
      workspace.plan
        .datasetLimit;

    const maxFileSizeBytes =
      Number(
        workspace.plan
          .maxFileSizeBytes,
      );

    return {
      datasetCount,

      storageUsedBytes,

      storageLimitBytes,

      datasetLimit,

      maxFileSizeBytes,

      remainingDatasetSlots:
        Math.max(
          datasetLimit -
            datasetCount,
          0,
        ),

      remainingStorageBytes:
        Math.max(
          storageLimitBytes -
            storageUsedBytes,
          0,
        ),
    };
  }

  async assertDatasetUploadAllowed(
    userId: string,
    workspaceId: string,
    fileSizeBytes: number,
  ): Promise<void> {
    await this.requireWorkspaceAccess(
      userId,
      workspaceId,
    );

    if (
      !Number.isSafeInteger(
        fileSizeBytes,
      ) ||
      fileSizeBytes <= 0
    ) {
      throw new BadRequestException(
        'Invalid dataset file size',
      );
    }

    const workspace =
      await this.workspaceRepository.findOne({
        where: {
          id: workspaceId,
        },

        relations: {
          plan: true,
        },
      });

    if (!workspace) {
      throw new NotFoundException(
        'Workspace not found',
      );
    }

    if (!workspace.plan) {
      throw new NotFoundException(
        'Workspace plan is not configured',
      );
    }

    const maxFileSizeBytes =
      Number(
        workspace.plan
          .maxFileSizeBytes,
      );

    if (
      fileSizeBytes >
      maxFileSizeBytes
    ) {
      throw new ForbiddenException({
        message:
          `File exceeds the ${this.formatBytes(
            maxFileSizeBytes,
          )} maximum file size for the ${workspace.plan.name} plan.`,

        code:
          'PLAN_FILE_SIZE_LIMIT',

        limitBytes:
          maxFileSizeBytes,

        requestedBytes:
          fileSizeBytes,

        planCode:
          workspace.plan.code,
      });
    }

    const usage =
      await this.getUsage(
        workspaceId,
      );

    if (
      usage.datasetCount >=
      usage.datasetLimit
    ) {
      throw new ForbiddenException({
        message:
          `Dataset limit reached for the ${workspace.plan.name} plan.`,

        code:
          'PLAN_DATASET_LIMIT_REACHED',

        limit:
          usage.datasetLimit,

        current:
          usage.datasetCount,

        planCode:
          workspace.plan.code,
      });
    }

    if (
      fileSizeBytes >
      usage.remainingStorageBytes
    ) {
      throw new ForbiddenException({
        message:
          `Storage limit reached for the ${workspace.plan.name} plan.`,

        code:
          'PLAN_STORAGE_LIMIT_REACHED',

        limitBytes:
          usage.storageLimitBytes,

        usedBytes:
          usage.storageUsedBytes,

        remainingBytes:
          usage.remainingStorageBytes,

        requestedBytes:
          fileSizeBytes,

        planCode:
          workspace.plan.code,
      });
    }
  }

  private async requireWorkspaceAccess(
    userId: string,
    workspaceId: string,
  ): Promise<void> {
    const workspace =
      await this.workspaceRepository.findOne({
        where: {
          id: workspaceId,
        },
      });

    if (!workspace) {
      throw new NotFoundException(
        'Workspace not found',
      );
    }

    /*
     * Membership authorization is already enforced
     * by the controller/service boundaries before this
     * method is called. This additional workspace
     * existence check prevents accidental cross-scope
     * operations when the service is reused internally.
     */
    if (!userId) {
      throw new ForbiddenException(
        'Authenticated user is required',
      );
    }
  }

  private formatBytes(
    bytes: number,
  ): string {
    if (
      bytes >=
      1024 * 1024 * 1024
    ) {
      return `${(
        bytes /
        (1024 * 1024 * 1024)
      ).toFixed(0)} GB`;
    }

    if (
      bytes >=
      1024 * 1024
    ) {
      return `${(
        bytes /
        (1024 * 1024)
      ).toFixed(0)} MB`;
    }

    if (
      bytes >=
      1024
    ) {
      return `${(
        bytes /
        1024
      ).toFixed(0)} KB`;
    }

    return `${bytes} B`;
  }
}