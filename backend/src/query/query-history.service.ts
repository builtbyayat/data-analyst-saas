import {
  Injectable,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import {
  FindOptionsWhere,
  Repository,
} from 'typeorm';

import { QueryHistory } from './query-history.entity.js';

export interface QueryHistoryListItem {
  id: string;
  datasetId: string;
  sql: string;
  rowCount: number | null;
  executionTimeMs: number | null;
  status: 'success' | 'failed';
  errorMessage: string | null;
  createdAt: Date;
}

@Injectable()
export class QueryHistoryService {
  constructor(
    @InjectRepository(QueryHistory)
    private readonly queryHistoryRepository: Repository<QueryHistory>,
  ) {}

  async listForUser(
    workspaceId: string,
    userId: string,
    datasetId?: string,
    limit = 50,
  ): Promise<QueryHistoryListItem[]> {
    const safeLimit =
      Math.max(
        1,
        Math.min(
          Math.floor(limit),
          100,
        ),
      );

    const where:
      FindOptionsWhere<QueryHistory> = {
        workspaceId,
        userId,
      };

    if (datasetId) {
      where.datasetId = datasetId;
    }

    const history =
      await this.queryHistoryRepository.find({
        where,

        order: {
          createdAt: 'DESC',
        },

        take: safeLimit,
      });

    return history.map(
      (item) => ({
        id: item.id,

        datasetId:
          item.datasetId,

        sql: item.sql,

        rowCount:
          item.rowCount,

        executionTimeMs:
          item.executionTimeMs,

        status:
          item.status,

        errorMessage:
          item.errorMessage,

        createdAt:
          item.createdAt,
      }),
    );
  }
}