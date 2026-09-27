import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { createHash } from 'node:crypto';
import { RateLimitService } from './rate-limit.service.js';
import { SecurityAuditService } from './security-audit.service.js';

interface RequestWithUser extends Request {
  user?: {
    id?: string;
    userId?: string;
    sub?: string;
  };
}

interface RateLimitPolicy {
  name: string;
  limit: number;
  windowSeconds: number;
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly rateLimitService: RateLimitService,
    private readonly securityAuditService: SecurityAuditService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(
    context: ExecutionContext,
  ): Promise<boolean> {
    const request =
      context
        .switchToHttp()
        .getRequest<RequestWithUser>();

    const response =
      context
        .switchToHttp()
        .getResponse<Response>();

    const path = this.getPath(request);

    if (this.shouldBypass(path)) {
      return true;
    }

    const policy =
      this.getPolicy(
        request.method,
        path,
      );

    const clientKey =
      this.getClientKey(request);

    const result =
      await this.rateLimitService.consume(
        this.hashKey(
          `${policy.name}:${clientKey}`,
        ),
        policy.limit,
        policy.windowSeconds,
      );

    response.setHeader(
      'X-RateLimit-Limit',
      String(result.limit),
    );

    response.setHeader(
      'X-RateLimit-Remaining',
      String(result.remaining),
    );

    response.setHeader(
      'X-RateLimit-Reset',
      String(
        Math.ceil(
          result.resetAt / 1000,
        ),
      ),
    );

    if (!result.allowed) {
      response.setHeader(
        'Retry-After',
        String(
          result.retryAfterSeconds,
        ),
      );

      this.securityAuditService.record(
        'rate_limit.exceeded',
        {
          route: policy.name,
          method: request.method,
          ip: clientKey,
        },
      );

      throw new HttpException(
        `Rate limit exceeded for ${policy.name}. Retry after ${result.retryAfterSeconds} seconds.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  private getPolicy(
    method: string,
    path: string,
  ): RateLimitPolicy {
    const normalizedPath =
      path.replace(/\/$/, '');

    if (
      method === 'POST' &&
      normalizedPath ===
        '/auth/login'
    ) {
      return {
        name: 'auth.login',
        limit: this.readInt(
          'RATE_LIMIT_AUTH_LOGIN_PER_MINUTE',
          10,
        ),
        windowSeconds: 60,
      };
    }

    if (
      method === 'POST' &&
      normalizedPath ===
        '/auth/register'
    ) {
      return {
        name: 'auth.register',
        limit: this.readInt(
          'RATE_LIMIT_AUTH_REGISTER_PER_15_MINUTES',
          5,
        ),
        windowSeconds: 15 * 60,
      };
    }

    if (
      method === 'GET' &&
      /^\/shared\/reports\/[^/]+$/.test(
        normalizedPath,
      )
    ) {
      return {
        name: 'shared.report.view',
        limit: this.readInt(
          'RATE_LIMIT_SHARED_REPORT_PER_MINUTE',
          30,
        ),
        windowSeconds: 60,
      };
    }

    if (
      method === 'GET' &&
      /^\/shared\/reports\/[^/]+\/export$/.test(
        normalizedPath,
      )
    ) {
      return {
        name: 'shared.report.export',
        limit: this.readInt(
          'RATE_LIMIT_SHARED_REPORT_EXPORT_PER_MINUTE',
          10,
        ),
        windowSeconds: 60,
      };
    }

    return {
      name: 'api.default',
      limit: this.readInt(
        'RATE_LIMIT_DEFAULT_PER_MINUTE',
        120,
      ),
      windowSeconds: 60,
    };
  }

  private shouldBypass(
    path: string,
  ): boolean {
    const normalizedPath =
      path.replace(/\/$/, '');

    return (
      normalizedPath === '' ||
      normalizedPath === '/' ||
      normalizedPath ===
        '/billing/razorpay/webhook'
    );
  }

  private getPath(
    request: Request,
  ): string {
    const rawPath =
      request.path ||
      request.originalUrl ||
      '/';

    return rawPath.split('?')[0] || '/';
  }

  private getClientKey(
    request: RequestWithUser,
  ): string {
    const trustProxy =
      this.configService.get<string>(
        'TRUST_PROXY',
        'false',
      ) === 'true';

    if (trustProxy) {
      const forwarded =
        request.header(
          'x-forwarded-for',
        );

      const firstForwarded =
        forwarded
          ?.split(',')[0]
          ?.trim();

      if (firstForwarded) {
        return firstForwarded;
      }
    }

    return (
      request.ip ||
      request.socket.remoteAddress ||
      'unknown'
    );
  }

  private hashKey(
    value: string,
  ): string {
    return createHash('sha256')
      .update(value)
      .digest('hex');
  }

  private readInt(
    name: string,
    fallback: number,
  ): number {
    const value = Number.parseInt(
      this.configService.get<string>(
        name,
        String(fallback),
      ),
      10,
    );

    return Number.isSafeInteger(value) &&
      value > 0
      ? value
      : fallback;
  }
}
