import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { PlanEntitlement } from './plan-entitlement.entity.js';

import { Workspace } from '../workspaces/workspace.entity.js';

import { WorkspaceAccessService } from '../workspaces/workspace-access.service.js';

export interface EntitlementItem {
  featureCode: string;
  enabled: boolean;
}

export interface WorkspaceEntitlementsResponse {
  workspaceId: string;

  plan: {
    code: string;
    name: string;
  };

  entitlements: EntitlementItem[];
}

@Injectable()
export class EntitlementsService {
  constructor(
    @InjectRepository(
      PlanEntitlement,
    )
    private readonly entitlementRepository: Repository<PlanEntitlement>,

    @InjectRepository(
      Workspace,
    )
    private readonly workspaceRepository: Repository<Workspace>,

    private readonly workspaceAccessService: WorkspaceAccessService,
  ) {}

  async listForWorkspace(
    userId: string,
    workspaceId: string,
  ): Promise<WorkspaceEntitlementsResponse> {
    await this.workspaceAccessService.requireMembership(
      userId,
      workspaceId,
    );

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

    const entitlements =
      await this.entitlementRepository.find({
        where: {
          planCode:
            workspace.plan.code,
        },
        order: {
          featureCode:
            'ASC',
        },
      });

    return {
      workspaceId,

      plan: {
        code:
          workspace.plan.code,

        name:
          workspace.plan.name,
      },

      entitlements:
        entitlements.map(
          (item) => ({
            featureCode:
              item.featureCode,

            enabled:
              item.enabled,
          }),
        ),
    };
  }

  async hasFeature(
    userId: string,
    workspaceId: string,
    featureCode: string,
  ): Promise<boolean> {
    await this.workspaceAccessService.requireMembership(
      userId,
      workspaceId,
    );

    const workspace =
      await this.workspaceRepository.findOne({
        where: {
          id: workspaceId,
        },
        relations: {
          plan: true,
        },
      });

    if (!workspace?.plan) {
      return false;
    }

    const entitlement =
      await this.entitlementRepository.findOne({
        where: {
          planCode:
            workspace.plan.code,

          featureCode,
        },
      });

    return entitlement?.enabled === true;
  }

  async requireFeature(
    userId: string,
    workspaceId: string,
    featureCode: string,
  ): Promise<void> {
    const enabled =
      await this.hasFeature(
        userId,
        workspaceId,
        featureCode,
      );

    if (!enabled) {
      throw new ForbiddenException({
        message:
          'This feature is not available on the current plan',
        code:
          'FEATURE_NOT_ENTITLED',
        featureCode,
      });
    }
  }
}