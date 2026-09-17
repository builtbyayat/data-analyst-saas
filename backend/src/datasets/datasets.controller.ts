import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import 'multer';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { randomUUID } from 'node:crypto';

import { WorkspaceAccessService } from '../workspaces/workspace-access.service.js';
import { StorageService } from '../storage/storage.service.js';
import { DatasetsService } from './datasets.service.js';

interface CreateDatasetDto {
  name: string;
  originalFilename: string;
  objectKey: string;
  fileType: string;
  fileSize: string;
}

@Controller('workspaces/:workspaceId/datasets')
@UseGuards(AuthGuard('jwt'))
export class DatasetsController {
  constructor(
    private readonly datasetsService: DatasetsService,
    private readonly workspaceAccessService: WorkspaceAccessService,
    private readonly storageService: StorageService,
  ) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 10 * 1024 * 1024,
      },
    }),
  )
  async upload(
    @Request() request: { user: { id: string } },
    @Param('workspaceId') workspaceId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('name') name?: string,
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

    const allowedMimeTypes = new Set([
      'text/csv',
      'application/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ]);

    if (!allowedMimeTypes.has(file.mimetype)) {
      throw new BadRequestException(
        'Only CSV and Excel files are supported',
      );
    }

    const datasetName =
      name?.trim() ||
      file.originalname.replace(/\.[^/.]+$/, '');

    const objectKey =
      `workspaces/${workspaceId}/datasets/${randomUUID()}-${file.originalname}`;

    await this.storageService.upload(
      objectKey,
      file.buffer,
      file.mimetype,
    );

    return this.datasetsService.createDataset(
      workspaceId,
      datasetName,
      file.originalname,
      objectKey,
      file.mimetype,
      String(file.size),
    );
  }

  @Post()
  async create(
    @Request() request: { user: { id: string } },
    @Param('workspaceId') workspaceId: string,
    @Body() body: CreateDatasetDto,
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
    @Request() request: { user: { id: string } },
    @Param('workspaceId') workspaceId: string,
  ) {
    await this.workspaceAccessService.requireMembership(
      request.user.id,
      workspaceId,
    );

    return this.datasetsService.listByWorkspace(
      workspaceId,
    );
  }

  @Get(':datasetId')
  async getOne(
    @Request() request: { user: { id: string } },
    @Param('workspaceId') workspaceId: string,
    @Param('datasetId') datasetId: string,
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

  @Delete(':datasetId')
  async delete(
    @Request() request: { user: { id: string } },
    @Param('workspaceId') workspaceId: string,
    @Param('datasetId') datasetId: string,
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