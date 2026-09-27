import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ErrorTrackingService } from './error-tracking.service.js';
import { MetricsController } from './metrics.controller.js';
import { MetricsService } from './metrics.service.js';
import { RequestTimingInterceptor } from './request-timing.interceptor.js';
import { StructuredLoggerService } from './structured-logger.service.js';

@Global()
@Module({
  imports: [ConfigModule],
  controllers: [MetricsController],
  providers: [
    MetricsService,
    StructuredLoggerService,
    ErrorTrackingService,
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestTimingInterceptor,
    },
  ],
  exports: [
    MetricsService,
    StructuredLoggerService,
    ErrorTrackingService,
  ],
})
export class ObservabilityModule {}
