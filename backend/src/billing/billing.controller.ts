import {
  Controller,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';

import { AuthGuard } from '@nestjs/passport';

import { BillingService } from './billing.service.js';
import { WorkspaceAccessService } from '../workspaces/workspace-access.service.js';

@Controller('workspaces')
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
    private readonly workspaceAccessService: WorkspaceAccessService,
  ) {}

  @UseGuards(
    AuthGuard('jwt'),
  )
  @Get(':workspaceId/plan')
  async getCurrentPlan(
    @Request()
    request: {
      user: {
        id: string;
      };
    },

    @Param(
      'workspaceId',
    )
    workspaceId: string,
  ) {
    return this.billingService.getCurrentPlan(
      request.user.id,
      workspaceId,
    );
  }

  @UseGuards(
    AuthGuard('jwt'),
  )
  @Post(
    ':workspaceId/billing/pro/subscribe',
  )
  async createProSubscription(
    @Request()
    request: {
      user: {
        id: string;
      };
    },

    @Param(
      'workspaceId',
    )
    workspaceId: string,
  ) {
    await this.workspaceAccessService.requireAdmin(
      request.user.id,
      workspaceId,
    );

    return this.billingService.createProSubscription(
      request.user.id,
      workspaceId,
    );
  }

  @UseGuards(
    AuthGuard('jwt'),
  )
  @Post(
    ':workspaceId/billing/pro/cancel',
  )
  async cancelProSubscription(
    @Request()
    request: {
      user: {
        id: string;
      };
    },

    @Param(
      'workspaceId',
    )
    workspaceId: string,
  ) {
    await this.workspaceAccessService.requireAdmin(
      request.user.id,
      workspaceId,
    );

    return this.billingService.cancelProSubscription(
      request.user.id,
      workspaceId,
    );
  }
}