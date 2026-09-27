import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { RateLimitGuard } from './rate-limit.guard.js';
import { RateLimitService } from './rate-limit.service.js';
import { SecurityAuditService } from './security-audit.service.js';

@Module({
  imports: [ConfigModule],
  providers: [
    RateLimitService,
    SecurityAuditService,
    {
      provide: APP_GUARD,
      useClass: RateLimitGuard,
    },
  ],
  exports: [
    RateLimitService,
    SecurityAuditService,
  ],
})
export class SecurityModule {}
