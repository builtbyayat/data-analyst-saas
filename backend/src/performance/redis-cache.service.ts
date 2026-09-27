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

@Injectable()
export class RedisCacheService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly client: RedisClientType;

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

    this.client = createClient({
      url,
    });

    this.client.on('error', () => {
      // Cache availability must not produce an unhandled Redis event.
    });
  }

  async onModuleInit(): Promise<void> {
    if (this.client.isOpen) {
      return;
    }

    try {
      await this.client.connect();
      await this.client.ping();
    } catch {
      throw new ServiceUnavailableException(
        'Redis cache storage is unavailable',
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.client.isOpen) {
      return;
    }

    await this.client.quit();
  }

  async get(
    key: string,
  ): Promise<string | null> {
    return this.client.get(key);
  }

  async set(
    key: string,
    value: string,
    ttlSeconds: number,
  ): Promise<void> {
    await this.client.set(
      key,
      value,
      {
        EX: ttlSeconds,
      },
    );
  }

  async del(
    key: string,
  ): Promise<void> {
    await this.client.del(key);
  }

  async ping(): Promise<string> {
    return this.client.ping();
  }
}