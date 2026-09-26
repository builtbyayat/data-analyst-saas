import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';

import 'multer';

import { AuthGuard } from '@nestjs/passport';

import {
  FileInterceptor,
} from '@nestjs/platform-express';

import {
  createHash,
  randomUUID,
} from 'node:crypto';

import { WorkspaceAccessService } from '../workspaces/workspace-access.service.js';

import { StorageService } from '../storage/storage.service.js';

import {
  UsageLimitsService,
} from '../billing/usage-limits.service.js';

import {
  DatasetsService,
} from './datasets.service.js';

import type {
  UpdateDatasetInput,
} from './datasets.service.js';

interface CreateDatasetDto {
  name: string;

  originalFilename: string;

  objectKey: string;

  fileType: string;

  fileSize: string;
}

const PLATFORM_MAX_UPLOAD_BYTES =
  1024 *
  1024 *
  1024;

const ALLOWED_MIME_TYPES =
  new Set([
    'text/csv',

    'application/csv',

    'application/vnd.ms-excel',

    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ]);

@Controller(
  'workspaces/:workspaceId/datasets',
)
@UseGuards(
  AuthGuard('jwt'),
)
export class DatasetsController {
  constructor(
    private readonly datasetsService:
      DatasetsService,

    private readonly workspaceAccessService:
      WorkspaceAccessService,

    private readonly storageService:
      StorageService,

    private readonly usageLimitsService:
      UsageLimitsService,
  ) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize:
          PLATFORM_MAX_UPLOAD_BYTES,
      },
    }),
  )
  async upload(
    @Request()
    request: {
      user: {
        id: string;
      };
    },

    @Param('workspaceId')
    workspaceId: string,

    @UploadedFile()
    file: Express.Multer.File,

    @Body('name')
    name?: string,
  ) {
    await this.workspaceAccessService.requireMembership(
      request.user.id,
      workspaceId,
    );

    if (!file) {
      throw new BadRequestException(
        'Dataset file is required',
      );
    }

    if (
      !ALLOWED_MIME_TYPES.has(
        file.mimetype,
      )
    ) {
      throw new BadRequestException(
        'Only CSV and Excel files are supported',
      );
    }

    /*
     * Plan limits are checked before
     * anything is written to object storage.
     */
    await this.usageLimitsService.assertDatasetUploadAllowed(
      request.user.id,
      workspaceId,
      file.size,
    );

    /*
     * SHA-256 is calculated from the actual
     * file content, not from the filename.
     *
     * This means the same file uploaded with
     * a different filename is still detected
     * as a duplicate.
     */
    const contentHash =
      createHash('sha256')
        .update(file.buffer)
        .digest('hex');

    /*
     * Fast duplicate check before object-storage
     * upload. The unique database index in
     * DatasetsService remains the final race-
     * condition protection.
     */
    const existingDataset =
      await this.datasetsService.findByContentHash(
        workspaceId,
        contentHash,
      );

    if (existingDataset) {
      throw new ConflictException({
        message:
          'This file is already uploaded to this workspace',

        code:
          'DUPLICATE_DATASET',

        datasetId:
          existingDataset.id,

        datasetName:
          existingDataset.name,

        originalFilename:
          existingDataset.originalFilename,
      });
    }

    const datasetName =
      name?.trim() ||
      file.originalname.replace(
        /\.[^/.]+$/,
        '',
      );

    const objectKey =
      `workspaces/${workspaceId}/datasets/${randomUUID()}-${file.originalname}`;

    try {
      await this.storageService.upload(
        objectKey,
        file.buffer,
        file.mimetype,
      );

      return await this.datasetsService.createDataset(
        workspaceId,

        datasetName,

        file.originalname,

        objectKey,

        file.mimetype,

        String(file.size),

        contentHash,
      );
    } catch (error) {
      /*
       * createDataset() may throw DUPLICATE_DATASET
       * because another request uploaded the same
       * file between our pre-check and database save.
       */
      try {
        await this.storageService.delete(
          objectKey,
        );
      } catch {
        /*
         * Preserve the original application
         * error if cleanup itself fails.
         */
      }

      throw error;
    }
  }

  @Post()
  async create(
    @Request()
    request: {
      user: {
        id: string;
      };
    },

    @Param('workspaceId')
    workspaceId: string,

    @Body()
    body: CreateDatasetDto,
  ) {
    await this.workspaceAccessService.requireMembership(
      request.user.id,
      workspaceId,
    );

    if (
      !body.name ||
      !body.originalFilename ||
      !body.objectKey ||
      !body.fileType ||
      !body.fileSize
    ) {
      throw new BadRequestException(
        'All dataset fields are required',
      );
    }

    const fileSize =
      Number(
        body.fileSize,
      );

    if (
      !Number.isSafeInteger(
        fileSize,
      ) ||
      fileSize <= 0
    ) {
      throw new BadRequestException(
        'Dataset file size must be a valid positive integer',
      );
    }

    await this.usageLimitsService.assertDatasetUploadAllowed(
      request.user.id,
      workspaceId,
      fileSize,
    );

    return this.datasetsService.createDataset(
      workspaceId,

      body.name,

      body.originalFilename,

      body.objectKey,

      body.fileType,

      body.fileSize,
    );
  }

  @Get()
  async list(
    @Request()
    request: {
      user: {
        id: string;
      };
    },

    @Param('workspaceId')
    workspaceId: string,

    @Query('limit')
    limit?: string,
  ) {
    await this.workspaceAccessService.requireMembership(
      request.user.id,
      workspaceId,
    );

    const parsedLimit =
      limit !== undefined
        ? Number(limit)
        : 50;

    return this.datasetsService.listByWorkspace(
      workspaceId,

      Number.isFinite(
        parsedLimit,
      )
        ? parsedLimit
        : 50,
    );
  }

  @Get(
    ':datasetId/context',
  )
  async getContext(
    @Request()
    request: {
      user: {
        id: string;
      };
    },

    @Param('workspaceId')
    workspaceId: string,

    @Param('datasetId')
    datasetId: string,
  ) {
    await this.workspaceAccessService.requireMembership(
      request.user.id,
      workspaceId,
    );

    return this.datasetsService.getAnalysisContext(
      datasetId,

      workspaceId,
    );
  }

  @Get(':datasetId')
  async getOne(
    @Request()
    request: {
      user: {
        id: string;
      };
    },

    @Param('workspaceId')
    workspaceId: string,

    @Param('datasetId')
    datasetId: string,
  ) {
    await this.workspaceAccessService.requireMembership(
      request.user.id,
      workspaceId,
    );

    return this.datasetsService.findById(
      datasetId,

      workspaceId,
    );
  }

  @Patch(':datasetId')
  async update(
    @Request()
    request: {
      user: {
        id: string;
      };
    },

    @Param('workspaceId')
    workspaceId: string,

    @Param('datasetId')
    datasetId: string,

    @Body()
    body: UpdateDatasetInput,
  ) {
    await this.workspaceAccessService.requireMembership(
      request.user.id,
      workspaceId,
    );

    return this.datasetsService.updateDataset(
      datasetId,

      workspaceId,

      body,
    );
  }

  @Delete(':datasetId')
  async delete(
    @Request()
    request: {
      user: {
        id: string;
      };
    },

    @Param('workspaceId')
    workspaceId: string,

    @Param('datasetId')
    datasetId: string,
  ) {
    await this.workspaceAccessService.requireMembership(
      request.user.id,
      workspaceId,
    );

    await this.datasetsService.deleteDataset(
      datasetId,

      workspaceId,
    );

    return {
      success: true,
    };
  }
}