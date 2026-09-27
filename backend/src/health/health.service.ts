import {
  Injectable,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { RedisCacheService } from '../performance/redis-cache.service.js';

export interface HealthStatus {
  status: 'ok' | 'degraded';
  uptimeSeconds: number;
  checks: {
    postgres: 'ok' | 'error';
    redis: 'ok' | 'error';
  };
  timestamp: string;
}

@Injectable()
export class HealthService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly redisCacheService: RedisCacheService,
  ) {}

  async check(): Promise<HealthStatus> {
    const [postgres, redis] =
      await Promise.all([
        this.checkPostgres(),
        this.checkRedis(),
      ]);

    return {
      status:
        postgres === 'ok' && redis === 'ok'
          ? 'ok'
          : 'degraded',
      uptimeSeconds: Math.floor(process.uptime()),
      checks: {
        postgres,
        redis,
      },
      timestamp: new Date().toISOString(),
    };
  }

  private async checkPostgres(): Promise<
    'ok' | 'error'
  > {
    try {
      await this.dataSource.query('SELECT 1');
      return 'ok';
    } catch {
      return 'error';
    }
  }

  private async checkRedis(): Promise<
    'ok' | 'error'
  > {
    try {
      await this.redisCacheService.ping();
      return 'ok';
    } catch {
      return 'error';
    }
  }
}
