import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { Repository } from 'typeorm';

import { Dataset } from './dataset.entity.js';
import { StorageService } from '../storage/storage.service.js';

@Injectable()
export class DatasetsService {
  constructor(
    @InjectRepository(Dataset)
    private readonly datasetRepository: Repository<Dataset>,

    @InjectQueue('dataset_ingestion')
    private readonly ingestionQueue: Queue,

    private readonly storageService: StorageService,
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

  async listByWorkspace(
    workspaceId: string,
  ): Promise<Dataset[]> {
    return this.datasetRepository.find({
      where: {
        workspaceId,
      },
      order: {
        createdAt: 'DESC',
      },
    });
  }

  async createDataset(
    workspaceId: string,
    name: string,
    originalFilename: string,
    objectKey: string,
    fileType: string,
    fileSize: string,
  ): Promise<Dataset> {
    const dataset =
      this.datasetRepository.create({
        workspaceId,
        name: name.trim(),
        originalFilename,
        objectKey,
        fileType,
        fileSize,
        rowCount: 0,
        columnCount: 0,
        status: 'pending',
      });

    const savedDataset =
      await this.datasetRepository.save(
        dataset,
      );

    await this.ingestionQueue.add(
      'process-dataset',
      {
        datasetId: savedDataset.id,
        workspaceId:
          savedDataset.workspaceId,
      },
    );

    return savedDataset;
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

    await this.datasetRepository.remove(
      dataset,
    );
  }
}