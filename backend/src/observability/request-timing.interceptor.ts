import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { Observable } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import { ErrorTrackingService } from './error-tracking.service.js';
import { MetricsService } from './metrics.service.js';
import { StructuredLoggerService } from './structured-logger.service.js';

interface RequestWithContext extends Request {
  requestId?: string;
}

@Injectable()
export class RequestTimingInterceptor
  implements NestInterceptor
{
  constructor(
    private readonly metricsService: MetricsService,
    private readonly errorTrackingService: ErrorTrackingService,
    private readonly logger: StructuredLoggerService,
  ) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    const http =
      context.switchToHttp();
    const request =
      http.getRequest<RequestWithContext>();
    const response =
      http.getResponse<Response>();

    const requestId =
      request.headers['x-request-id'] &&
      typeof request.headers['x-request-id'] === 'string'
        ? request.headers['x-request-id'].slice(0, 100)
        : randomUUID();

    request.requestId = requestId;
    response.setHeader(
      'X-Request-Id',
      requestId,
    );

    const startedAt = performance.now();
    const method = request.method;
    const route =
      request.route?.path ??
      request.path ??
      'unknown';

    let failedError: unknown = null;

    return next.handle().pipe(
      catchError((error: unknown) => {
        failedError = error;
        throw error;
      }),
      finalize(() => {
        const durationMs =
          performance.now() -
          startedAt;
        const statusCode =
          response.statusCode;

        this.metricsService.increment(
          'http.requests.total',
        );
        this.metricsService.observe(
          'http.request.duration_ms',
          durationMs,
        );

        if (statusCode >= 400) {
          this.metricsService.increment(
            'http.errors.total',
          );
        }

        if (failedError !== null) {
          this.errorTrackingService.record(
            failedError,
            {
              statusCode,
              requestId,
              route,
            },
          );
        }

        this.logger.log(
          'http.request.completed',
          {
            requestId,
            method,
            route,
            statusCode,
            durationMs: Number(
              durationMs.toFixed(2),
            ),
          },
        );
      }),
    );
  }
}
