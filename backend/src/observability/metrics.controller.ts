import {
  Controller,
  Get,
  Headers,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MetricsService } from './metrics.service.js';
import { ErrorTrackingService } from './error-tracking.service.js';

@Controller('internal')
export class MetricsController {
  constructor(
    private readonly metricsService: MetricsService,
    private readonly errorTrackingService: ErrorTrackingService,
    private readonly configService: ConfigService,
  ) {}

  @Get('metrics')
  getMetrics(
    @Headers('x-metrics-token')
    token?: string,
  ) {
    this.authorize(token);

    return this.metricsService.snapshot();
  }

  @Get('errors')
  getErrors(
    @Headers('x-metrics-token')
    token?: string,
  ) {
    this.authorize(token);

    return {
      errors:
        this.errorTrackingService.getRecent(),
    };
  }

  private authorize(
    token?: string,
  ): void {
    const configured =
      this.configService
        .get<string>('METRICS_TOKEN')
        ?.trim();

    const production =
      process.env.NODE_ENV === 'production';

    if (!configured) {
      if (production) {
        throw new NotFoundException();
      }

      return;
    }

    if (
      !token ||
      token !== configured
    ) {
      throw new UnauthorizedException(
        'Metrics token is invalid',
      );
    }
  }
}
