import { describe, expect, it, vi } from 'vitest';
import { ErrorTrackingService } from './error-tracking.service.js';

describe('ErrorTrackingService', () => {
  it('records bounded sanitized operational errors', () => {
    const metrics = {
      increment: vi.fn(),
    };

    const logger = {
      error: vi.fn(),
    };

    const service = new ErrorTrackingService(
      metrics as never,
      logger as never,
    );

    service.record(
      new Error('query failed'),
      {
        statusCode: 500,
        requestId: 'req-1',
        route: '/query',
      },
    );

    expect(
      service.getRecent(),
    ).toMatchObject([
      {
        message: 'query failed',
        statusCode: 500,
        requestId: 'req-1',
        route: '/query',
      },
    ]);

    expect(metrics.increment).toHaveBeenCalledWith(
      'app.errors.total',
    );
  });
});
