import {
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';

import {
  Repository,
} from 'typeorm';

import { WorkspaceUsageDaily } from './workspace-usage-daily.entity.js';

import { Workspace } from '../workspaces/workspace.entity.js';

export interface PlanUsageSnapshot {
  workspaceId: string;

  usageDate: string;

  plan: {
    code: string;

    name: string;
  };

  aiQueries: {
    used: number;

    limit: number;

    remaining: number;
  };

  sqlExecutions: {
    used: number;

    limit: number;

    remaining: number;
  };
}

@Injectable()
export class PlanUsageService {
  constructor(
    @InjectRepository(
      WorkspaceUsageDaily,
    )
    private readonly usageRepository:
      Repository<WorkspaceUsageDaily>,

    @InjectRepository(
      Workspace,
    )
    private readonly workspaceRepository:
      Repository<Workspace>,
  ) {}

  async getUsage(
    workspaceId: string,
  ): Promise<PlanUsageSnapshot> {
    const workspace =
      await this.getWorkspace(
        workspaceId,
      );

    const usage =
      await this.getOrCreateTodayUsage(
        workspaceId,
      );

    const aiLimit =
      workspace.plan.aiQueriesPerDay;

    const sqlLimit =
      workspace.plan.sqlExecutionsPerDay;

    return {
      workspaceId,

      usageDate:
        usage.usageDate,

      plan: {
        code:
          workspace.plan.code,

        name:
          workspace.plan.name,
      },

      aiQueries: {
        used:
          usage.aiQueryCount,

        limit:
          aiLimit,

        remaining:
          Math.max(
            aiLimit -
              usage.aiQueryCount,
            0,
          ),
      },

      sqlExecutions: {
        used:
          usage.sqlExecutionCount,

        limit:
          sqlLimit,

        remaining:
          Math.max(
            sqlLimit -
              usage.sqlExecutionCount,
            0,
          ),
      },
    };
  }

  async consumeAiQuery(
    workspaceId: string,
  ): Promise<void> {
    const workspace =
      await this.getWorkspace(
        workspaceId,
      );

    const usageDate =
      this.getUtcDate();

    const limit =
      workspace.plan
        .aiQueriesPerDay;

    const result =
      await this.usageRepository.query(
        `
          INSERT INTO "workspace_usage_daily"
            (
              "workspaceId",
              "usageDate",
              "aiQueryCount",
              "sqlExecutionCount"
            )
          VALUES
            ($1, $2, 1, 0)

          ON CONFLICT
            ("workspaceId", "usageDate")
          DO UPDATE
          SET
            "aiQueryCount" =
              "workspace_usage_daily"."aiQueryCount" + 1,

            "updatedAt" = now()

          WHERE
            "workspace_usage_daily"."aiQueryCount" < $3

          RETURNING
            "aiQueryCount",
            "sqlExecutionCount"
        `,
        [
          workspaceId,
          usageDate,
          limit,
        ],
      );

    if (!result.length) {
      throw new HttpException(
        {
          message:
            `Daily AI query limit reached for the ${workspace.plan.name} plan.`,

          code:
            'PLAN_AI_QUERY_LIMIT_REACHED',

          planCode:
            workspace.plan.code,

          limit,

          usageDate,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  async consumeSqlExecution(
    workspaceId: string,
  ): Promise<void> {
    const workspace =
      await this.getWorkspace(
        workspaceId,
      );

    const usageDate =
      this.getUtcDate();

    const limit =
      workspace.plan
        .sqlExecutionsPerDay;

    const result =
      await this.usageRepository.query(
        `
          INSERT INTO "workspace_usage_daily"
            (
              "workspaceId",
              "usageDate",
              "aiQueryCount",
              "sqlExecutionCount"
            )
          VALUES
            ($1, $2, 0, 1)

          ON CONFLICT
            ("workspaceId", "usageDate")
          DO UPDATE
          SET
            "sqlExecutionCount" =
              "workspace_usage_daily"."sqlExecutionCount" + 1,

            "updatedAt" = now()

          WHERE
            "workspace_usage_daily"."sqlExecutionCount" < $3

          RETURNING
            "aiQueryCount",
            "sqlExecutionCount"
        `,
        [
          workspaceId,
          usageDate,
          limit,
        ],
      );

    if (!result.length) {
      throw new HttpException(
        {
          message:
            `Daily SQL execution limit reached for the ${workspace.plan.name} plan.`,

          code:
            'PLAN_SQL_EXECUTION_LIMIT_REACHED',

          planCode:
            workspace.plan.code,

          limit,

          usageDate,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  async consumeAiAndSql(
    workspaceId: string,
  ): Promise<void> {
    const workspace =
      await this.getWorkspace(
        workspaceId,
      );

    const usageDate =
      this.getUtcDate();

    const aiLimit =
      workspace.plan
        .aiQueriesPerDay;

    const sqlLimit =
      workspace.plan
        .sqlExecutionsPerDay;

    const result =
      await this.usageRepository.query(
        `
          INSERT INTO "workspace_usage_daily"
            (
              "workspaceId",
              "usageDate",
              "aiQueryCount",
              "sqlExecutionCount"
            )
          VALUES
            ($1, $2, 1, 1)

          ON CONFLICT
            ("workspaceId", "usageDate")
          DO UPDATE
          SET
            "aiQueryCount" =
              "workspace_usage_daily"."aiQueryCount" + 1,

            "sqlExecutionCount" =
              "workspace_usage_daily"."sqlExecutionCount" + 1,

            "updatedAt" = now()

          WHERE
            "workspace_usage_daily"."aiQueryCount" < $3

            AND
            "workspace_usage_daily"."sqlExecutionCount" < $4

          RETURNING
            "aiQueryCount",
            "sqlExecutionCount"
        `,
        [
          workspaceId,
          usageDate,
          aiLimit,
          sqlLimit,
        ],
      );

    if (result.length) {
      return;
    }

    const currentUsage =
      await this.getOrCreateTodayUsage(
        workspaceId,
      );

    if (
      currentUsage.aiQueryCount >=
      aiLimit
    ) {
      throw new HttpException(
        {
          message:
            `Daily AI query limit reached for the ${workspace.plan.name} plan.`,

          code:
            'PLAN_AI_QUERY_LIMIT_REACHED',

          planCode:
            workspace.plan.code,

          limit:
            aiLimit,

          usageDate,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    throw new HttpException(
      {
        message:
          `Daily SQL execution limit reached for the ${workspace.plan.name} plan.`,

        code:
          'PLAN_SQL_EXECUTION_LIMIT_REACHED',

        planCode:
          workspace.plan.code,

        limit:
          sqlLimit,

        usageDate,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  private async getWorkspace(
    workspaceId: string,
  ): Promise<Workspace> {
    const workspace =
      await this.workspaceRepository.findOne({
        where: {
          id: workspaceId,
        },

        relations: {
          plan: true,
        },
      });

    if (!workspace) {
      throw new NotFoundException(
        'Workspace not found',
      );
    }

    if (!workspace.plan) {
      throw new NotFoundException(
        'Workspace plan is not configured',
      );
    }

    return workspace;
  }

  private async getOrCreateTodayUsage(
    workspaceId: string,
  ): Promise<WorkspaceUsageDaily> {
    const usageDate =
      this.getUtcDate();

    const existing =
      await this.usageRepository.findOne({
        where: {
          workspaceId,

          usageDate,
        },
      });

    if (existing) {
      return existing;
    }

    try {
      return await this.usageRepository.save(
        this.usageRepository.create({
          workspaceId,

          usageDate,

          aiQueryCount: 0,

          sqlExecutionCount: 0,
        }),
      );
    } catch {
      const created =
        await this.usageRepository.findOne({
          where: {
            workspaceId,

            usageDate,
          },
        });

      if (!created) {
        throw new Error(
          'Could not initialize daily workspace usage',
        );
      }

      return created;
    }
  }

  private getUtcDate(): string {
    return new Date()
      .toISOString()
      .slice(0, 10);
  }
}