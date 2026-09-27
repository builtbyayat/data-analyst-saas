import { ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RateLimitGuard } from './rate-limit.guard.js';
import { RateLimitService } from './rate-limit.service.js';
import { SecurityAuditService } from './security-audit.service.js';

describe('RateLimitGuard', () => {
  const rateLimitService = {
    consume: vi.fn(),
  } as unknown as RateLimitService;

  const auditService = {
    record: vi.fn(),
  } as unknown as SecurityAuditService;

  const configService = {
    get: vi.fn(
      (
        _name: string,
        fallback: string,
      ) => fallback,
    ),
  } as unknown as ConfigService;

  const guard = new RateLimitGuard(
    rateLimitService,
    auditService,
    configService,
  );

  function context(
    path: string,
    method = 'GET',
  ) {
    const request = {
      path,
      method,
      ip: '127.0.0.1',
      socket: {
        remoteAddress: '127.0.0.1',
      },
      header: vi.fn(),
    };

    const response = {
      setHeader: vi.fn(),
    };

    return {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    } as unknown as ExecutionContext;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    rateLimitService.consume = vi
      .fn()
      .mockResolvedValue({
        allowed: true,
        limit: 120,
        remaining: 119,
        retryAfterSeconds: 60,
        resetAt: Date.now() + 60_000,
      });
  });

  it('uses the dedicated login policy', async () => {
    await guard.canActivate(
      context('/auth/login', 'POST'),
    );

    expect(
      rateLimitService.consume,
    ).toHaveBeenCalledWith(
      expect.any(String),
      10,
      60,
    );
  });

  it('uses the dedicated public export policy', async () => {
    await guard.canActivate(
      context(
        '/shared/reports/token/export',
        'GET',
      ),
    );

    expect(
      rateLimitService.consume,
    ).toHaveBeenCalledWith(
      expect.any(String),
      10,
      60,
    );
  });

  it('bypasses the Razorpay webhook', async () => {
    await guard.canActivate(
      context(
        '/billing/razorpay/webhook',
        'POST',
      ),
    );

    expect(
      rateLimitService.consume,
    ).not.toHaveBeenCalled();
  });
});
