import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';

import type { Request } from 'express';

import { Observable } from 'rxjs';

import {
  PlanUsageService,
} from './plan-usage.service.js';

interface AuthenticatedRequest
  extends Request {
  user?: {
    id?: string;
    userId?: string;
    sub?: string;
  };
}

@Injectable()
export class PlanUsageInterceptor
  implements NestInterceptor
{
  constructor(
    private readonly planUsageService:
      PlanUsageService,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    if (
      context.getType() !==
      'http'
    ) {
      return next.handle();
    }

    const request =
      context
        .switchToHttp()
        .getRequest<AuthenticatedRequest>();

    if (
      request.method !==
      'POST'
    ) {
      return next.handle();
    }

    const workspaceId =
      request.params
        ?.workspaceId;

    if (
      typeof workspaceId !==
        'string' ||
      !workspaceId.trim()
    ) {
      return next.handle();
    }

    const routePath =
      this.getRoutePath(
        request,
      );

    /*
     * SQL + AI:
     * A natural-language query first uses one AI
     * query and then executes one SQL query.
     *
     * We consume both atomically so a request
     * can never consume one quota and fail while
     * reserving the other quota.
     */
    if (
      routePath.includes(
        '/query-from-question',
      )
    ) {
      await this.planUsageService.consumeAiAndSql(
        workspaceId,
      );

      return next.handle();
    }

    /*
     * SQL generation only.
     */
    if (
      routePath.includes(
        '/generate-sql',
      )
    ) {
      await this.planUsageService.consumeAiQuery(
        workspaceId,
      );

      return next.handle();
    }

    /*
     * SQL editor / direct SQL execution.
     */
    if (
      this.isSqlExecutionRoute(
        routePath,
      )
    ) {
      await this.planUsageService.consumeSqlExecution(
        workspaceId,
      );

      return next.handle();
    }

    return next.handle();
  }

  private getRoutePath(
    request: Request,
  ): string {
    const route =
      request.route?.path;

    if (
      typeof route ===
      'string'
    ) {
      return route;
    }

    return request.path;
  }

  private isSqlExecutionRoute(
    routePath: string,
  ): boolean {
    return (
      routePath.endsWith(
        '/datasets/:datasetId/query',
      ) ||
      routePath.endsWith(
        '/datasets/:datasetId/query/jobs',
      ) ||
      routePath.endsWith(
        '/multi-datasets/query',
      ) ||
      routePath.endsWith(
        '/multi-datasets/query/jobs',
      )
    );
  }
}