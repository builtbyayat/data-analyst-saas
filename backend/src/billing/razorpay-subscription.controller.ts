import {
  Controller,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';

import {
  AuthGuard,
} from '@nestjs/passport';

import {
  RazorpaySubscriptionService,
} from './razorpay-subscription.service.js';

@Controller(
  'workspaces',
)
export class RazorpaySubscriptionController {
  constructor(
    private readonly razorpaySubscriptionService:
      RazorpaySubscriptionService,
  ) {}

  @UseGuards(
    AuthGuard('jwt'),
  )
  @Post(
    ':workspaceId/billing/razorpay/subscription',
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
    return this.razorpaySubscriptionService.createProSubscription(
      request.user.id,
      workspaceId,
    );
  }
}