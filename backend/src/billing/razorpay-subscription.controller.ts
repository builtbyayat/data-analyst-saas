import {
  Controller,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';

import { AuthGuard } from '@nestjs/passport';

import { RazorpaySubscriptionService } from './razorpay-subscription.service.js';
import { WorkspaceAccessService } from '../workspaces/workspace-access.service.js';

@Controller('workspaces')
export class RazorpaySubscriptionController {
  constructor(
    private readonly razorpaySubscriptionService:
      RazorpaySubscriptionService,
    private readonly workspaceAccessService:
      WorkspaceAccessService,
  ) {}

  @UseGuards(AuthGuard('jwt'))
  @Post(':workspaceId/billing/razorpay/subscription')
  async createProSubscription(
    @Request()
    request: {
      user: {
        id: string;
      };
    },
    @Param('workspaceId')
    workspaceId: string,
  ) {
    await this.workspaceAccessService.requireAdmin(
      request.user.id,
      workspaceId,
    );

    return this.razorpaySubscriptionService.createProSubscription(
      request.user.id,
      workspaceId,
    );
  }
}