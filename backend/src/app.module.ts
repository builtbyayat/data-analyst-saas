import { Module } from '@nestjs/common';
import {
  ConfigModule,
  ConfigService,
} from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';

import { AuthModule } from './auth/auth.module.js';
import { UsersModule } from './users/users.module.js';
import { WorkspacesModule } from './workspaces/workspaces.module.js';
import { DatasetsModule } from './datasets/datasets.module.js';
import { StorageModule } from './storage/storage.module.js';
import { QueryModule } from './query/query.module.js';
import { AiModule } from './ai/ai.module.js';

import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],

      useFactory: (
        configService: ConfigService,
      ) => ({
        type: 'postgres',

        host: configService.get<string>(
          'DATABASE_HOST',
        ),

        port: Number(
          configService.get<string>(
            'DATABASE_PORT',
          ),
        ),

        username:
          configService.get<string>(
            'DATABASE_USER',
          ),

        password: String(
          configService.get<string>(
            'DATABASE_PASSWORD',
          ) ?? '',
        ),

        database:
          configService.get<string>(
            'DATABASE_NAME',
          ),

        autoLoadEntities: true,

        synchronize: false,
      }),
    }),

    BullModule.forRootAsync({
      imports: [ConfigModule],

      inject: [ConfigService],

      useFactory: (
        configService: ConfigService,
      ) => ({
        connection: {
          host:
            configService.get<string>(
              'REDIS_HOST',
              'localhost',
            ),

          port: Number(
            configService.get<string>(
              'REDIS_PORT',
              '6379',
            ),
          ),
        },
      }),
    }),

    BullModule.registerQueue(
      {
        name: 'analysis',
      },
      {
        name: 'dataset_ingestion',
      },
    ),

    UsersModule,

    AuthModule,

    WorkspacesModule,

    DatasetsModule,

    StorageModule,

    QueryModule,

    AiModule,
  ],

  controllers: [
    AppController,
  ],

  providers: [
    AppService,
  ],
})
export class AppModule {}