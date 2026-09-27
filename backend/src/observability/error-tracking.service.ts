import { Injectable } from '@nestjs/common';
import { MetricsService } from './metrics.service.js';
import { StructuredLoggerService } from './structured-logger.service.js';

export interface TrackedError {
  timestamp: string;
  name: string;
  message: string;
  statusCode: number | null;
  requestId: string | null;
  route: string | null;
}

@Injectable()
export class ErrorTrackingService {
  private readonly recentErrors: TrackedError[] = [];
  private readonly maxRecentErrors = 100;

  constructor(
    private readonly metricsService: MetricsService,
    private readonly logger: StructuredLoggerService,
  ) {}

  private sanitizeMessage(message: string): string {
    return message
      .replace(
        /((?:password|passwd|secret|token|api[_-]?key|authorization)\s*[:=]\s*)([^\s,;]+)/gi,
        '$1[REDACTED]',
      )
      .replace(
        /Bearer\s+[^\s]+/gi,
        'Bearer [REDACTED]',
      )
      .slice(0, 1000);
  }

  record(
    error: unknown,
    context: {
      statusCode?: number | null;
      requestId?: string | null;
      route?: string | null;
    } = {},
  ): void {
    const exception =
      error instanceof Error
        ? error
        : new Error(String(error));

    const tracked: TrackedError = {
      timestamp:
        new Date().toISOString(),
      name:
        exception.name || 'Error',
      message:
        this.sanitizeMessage(
          exception.message,
        ),
      statusCode:
        context.statusCode ?? null,
      requestId:
        context.requestId ?? null,
      route:
        context.route ?? null,
    };

    this.recentErrors.push(tracked);

    if (
      this.recentErrors.length >
      this.maxRecentErrors
    ) {
      this.recentErrors.splice(
        0,
        this.recentErrors.length -
          this.maxRecentErrors,
      );
    }

    this.metricsService.increment(
      'app.errors.total',
    );

    this.logger.error(
      'application.error',
      tracked,
    );
  }

  getRecent(
    limit = 20,
  ): TrackedError[] {
    const safeLimit = Math.max(
      1,
      Math.min(
        Math.floor(limit),
        this.maxRecentErrors,
      ),
    );

    return this.recentErrors
      .slice(-safeLimit)
      .reverse();
  }
}
