import { Injectable } from '@nestjs/common';
import { CacheService } from './cache.service.js';

export interface CachedQueryResult {
  columns: string[];
  rows: unknown[][];
}

@Injectable()
export class QueryCacheService {
  private readonly ttlSeconds = this.readPositiveInt(
    'QUERY_CACHE_TTL_SECONDS',
    30,
    300,
  );

  private readonly maxRows = this.readPositiveInt(
    'QUERY_CACHE_MAX_ROWS',
    5000,
    5000,
  );

  private readonly maxPayloadBytes = this.readPositiveInt(
    'QUERY_CACHE_MAX_PAYLOAD_BYTES',
    1_500_000,
    5_000_000,
  );

  constructor(
    private readonly cacheService: CacheService,
  ) {}

  async get(
    workspaceId: string,
    datasetId: string,
    datasetVersion: string,
    sql: string,
  ): Promise<CachedQueryResult | null> {
    return this.cacheService.get<CachedQueryResult>(
      this.buildKey(
        workspaceId,
        datasetId,
        datasetVersion,
        sql,
      ),
    );
  }

  async set(
    workspaceId: string,
    datasetId: string,
    datasetVersion: string,
    sql: string,
    result: CachedQueryResult,
  ): Promise<boolean> {
    if (result.rows.length > this.maxRows) {
      return false;
    }

    const serialized = JSON.stringify(result);

    if (
      Buffer.byteLength(
        serialized,
        'utf8',
      ) > this.maxPayloadBytes
    ) {
      return false;
    }

    return this.cacheService.set(
      this.buildKey(
        workspaceId,
        datasetId,
        datasetVersion,
        sql,
      ),
      result,
      this.ttlSeconds,
    );
  }

  private buildKey(
    workspaceId: string,
    datasetId: string,
    datasetVersion: string,
    sql: string,
  ): string {
    const normalizedSql =
      sql
        .replace(/\s+/g, ' ')
        .trim();

    const input = [
      'query-result:v1',
      workspaceId,
      datasetId,
      datasetVersion,
      normalizedSql,
    ].join('|');

    return `performance:${CacheService.hashKey(input)}`;
  }

  private readPositiveInt(
    key: string,
    fallback: number,
    max: number,
  ): number {
    const parsed = Number.parseInt(
      process.env[key] ?? String(fallback),
      10,
    );

    if (
      !Number.isSafeInteger(parsed) ||
      parsed <= 0
    ) {
      return fallback;
    }

    return Math.min(parsed, max);
  }
}
