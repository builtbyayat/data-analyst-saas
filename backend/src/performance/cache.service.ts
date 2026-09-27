import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { RedisCacheService } from './redis-cache.service.js';

@Injectable()
export class CacheService {
  private readonly defaultTtlSeconds = 30;

  constructor(
    private readonly redisCacheService: RedisCacheService,
  ) {}

  async get<T>(
    key: string,
  ): Promise<T | null> {
    try {
      const serialized =
        await this.redisCacheService.get(key);

      if (serialized === null) {
        return null;
      }

      return JSON.parse(serialized) as T;
    } catch {
      return null;
    }
  }

  async set<T>(
    key: string,
    value: T,
    ttlSeconds = this.defaultTtlSeconds,
  ): Promise<boolean> {
    if (
      !Number.isSafeInteger(ttlSeconds) ||
      ttlSeconds <= 0
    ) {
      return false;
    }

    try {
      const serialized = JSON.stringify(value);

      if (!serialized) {
        return false;
      }

      await this.redisCacheService.set(
        key,
        serialized,
        ttlSeconds,
      );

      return true;
    } catch {
      return false;
    }
  }

  async delete(
    key: string,
  ): Promise<void> {
    try {
      await this.redisCacheService.del(key);
    } catch {
      // Cache invalidation failures must not break the application.
    }
  }

  static hashKey(
    input: string,
  ): string {
    return createHash('sha256')
      .update(input)
      .digest('hex');
  }
}
