import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';

import { Dataset } from './dataset.entity.js';
import { DatasetColumn } from './dataset-column.entity.js';
import { DatasetsService } from './datasets.service.js';
import { DatasetsController } from './datasets.controller.js';

import { WorkspacesModule } from '../workspaces/workspaces.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Dataset,
      DatasetColumn,
    ]),

    BullModule.registerQueue({
      name: 'dataset_ingestion',
    }),

    WorkspacesModule,
  ],

  controllers: [
    DatasetsController,
  ],

  providers: [
    DatasetsService,
  ],

  exports: [
    DatasetsService,
  ],
})
export class DatasetsModule {}