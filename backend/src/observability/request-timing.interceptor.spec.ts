import { describe, expect, it, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { RequestTimingInterceptor } from './request-timing.interceptor.js';

describe('RequestTimingInterceptor', () => {
  it('adds request id and records successful requests', async () => {
    const metrics = {
      increment: vi.fn(),
      observe: vi.fn(),
    };
    const errors = {
      record: vi.fn(),
    };
    const logger = {
      log: vi.fn(),
    };

    const service = new RequestTimingInterceptor(
      metrics as never,
      errors as never,
      logger as never,
    );

    const request = {
      method: 'GET',
      path: '/health',
      headers: {},
    };
    const response = {
      statusCode: 200,
      setHeader: vi.fn(),
    };

    const observable = service.intercept(
      {
        switchToHttp: () => ({
          getRequest: () => request,
          getResponse: () => response,
        }),
      } as never,
      {
        handle: () => of({ ok: true }),
      },
    );

    await new Promise<void>((resolve, reject) => {
      observable.subscribe({
        complete: resolve,
        error: reject,
      });
    });

    expect(request.headers).toBeDefined();
    expect(response.setHeader).toHaveBeenCalledWith(
      'X-Request-Id',
      expect.any(String),
    );
    expect(metrics.increment).toHaveBeenCalledWith(
      'http.requests.total',
    );
  });

  it('tracks errors without swallowing them', async () => {
    const metrics = {
      increment: vi.fn(),
      observe: vi.fn(),
    };
    const errors = {
      record: vi.fn(),
    };
    const logger = {
      log: vi.fn(),
    };

    const service = new RequestTimingInterceptor(
      metrics as never,
      errors as never,
      logger as never,
    );

    const request = {
      method: 'GET',
      path: '/broken',
      headers: {},
    };
    const response = {
      statusCode: 500,
      setHeader: vi.fn(),
    };

    await new Promise<void>((resolve) => {
      service
        .intercept(
          {
            switchToHttp: () => ({
              getRequest: () => request,
              getResponse: () => response,
            }),
          } as never,
          {
            handle: () =>
              throwError(() => new Error('boom')),
          },
        )
        .pipe()
        .subscribe({
          error: () => resolve(),
        });
    });

    expect(errors.record).toHaveBeenCalled();
  });
});
