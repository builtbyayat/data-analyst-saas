import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CacheService } from './cache.service.js';
import { QueryCacheService } from './query-cache.service.js';
import { RedisCacheService } from './redis-cache.service.js';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    RedisCacheService,
    CacheService,
    QueryCacheService,
  ],
  exports: [
    RedisCacheService,
    CacheService,
    QueryCacheService,
  ],
})
export class PerformanceModule {}
