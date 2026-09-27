import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createClient,
  type RedisClientType,
} from 'redis';

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
  resetAt: number;
}

@Injectable()
export class RateLimitService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly redis: RedisClientType;

  constructor(
    private readonly configService: ConfigService,
  ) {
    const configuredUrl =
      configService.get<string>('REDIS_URL')?.trim();

    const host =
      configService.get<string>(
        'REDIS_HOST',
        'localhost',
      );

    const port = Number(
      configService.get<string>(
        'REDIS_PORT',
        '6379',
      ),
    );

    const password =
      configService.get<string>(
        'REDIS_PASSWORD',
      )?.trim();

    const url =
      configuredUrl ||
      `redis://${
        password
          ? `:${encodeURIComponent(password)}@`
          : ''
      }${host}:${port}`;

    this.redis = createClient({
      url,
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.redis.connect();
      await this.redis.ping();
    } catch {
      throw new ServiceUnavailableException(
        'Rate-limit storage is unavailable',
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.redis.isOpen) {
      return;
    }

    await this.redis.quit();
  }

  async consume(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<RateLimitResult> {
    if (
      !Number.isSafeInteger(limit) ||
      limit <= 0 ||
      !Number.isSafeInteger(windowSeconds) ||
      windowSeconds <= 0
    ) {
      throw new Error(
        'Rate-limit configuration is invalid',
      );
    }

    const redisKey =
      `security:rate:${key}`;

    const script = `
      local current = redis.call('INCR', KEYS[1])
      if current == 1 then
        redis.call('EXPIRE', KEYS[1], ARGV[1])
      end
      local ttl = redis.call('TTL', KEYS[1])
      return { current, ttl }
    `;

    let result: unknown;

    try {
      result = await this.redis.eval(
        script,
        {
          keys: [redisKey],
          arguments: [
            String(windowSeconds),
          ],
        },
      );
    } catch {
      throw new ServiceUnavailableException(
        'Rate-limit storage is unavailable',
      );
    }

    if (
      !Array.isArray(result) ||
      result.length < 2
    ) {
      throw new ServiceUnavailableException(
        'Rate-limit storage returned an invalid response',
      );
    }

    const current = Number(result[0]);
    const ttl = Number(result[1]);

    if (
      !Number.isSafeInteger(current) ||
      !Number.isSafeInteger(ttl) ||
      ttl < 0
    ) {
      throw new ServiceUnavailableException(
        'Rate-limit storage returned an invalid response',
      );
    }

    return {
      allowed: current <= limit,
      limit,
      remaining: Math.max(
        0,
        limit - current,
      ),
      retryAfterSeconds:
        current <= limit
          ? 0
          : Math.max(1, ttl),
      resetAt:
        Date.now() +
        ttl * 1000,
    };
  }
}
