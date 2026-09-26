import { Module } from '@nestjs/common';

import {
  APP_INTERCEPTOR,
} from '@nestjs/core';

import {
  TypeOrmModule,
} from '@nestjs/typeorm';

import {
  Dataset,
} from '../datasets/dataset.entity.js';

import {
  Workspace,
} from '../workspaces/workspace.entity.js';

import {
  WorkspacesModule,
} from '../workspaces/workspaces.module.js';

import {
  BillingController,
} from './billing.controller.js';

import {
  BillingService,
} from './billing.service.js';

import {
  BillingWebhookController,
} from './billing-webhook.controller.js';

import {
  EntitlementsController,
} from './entitlements.controller.js';

import {
  EntitlementsService,
} from './entitlements.service.js';

import {
  Plan,
} from './plan.entity.js';

import {
  PlanEntitlement,
} from './plan-entitlement.entity.js';

import {
  PlanUsageInterceptor,
} from './plan-usage.interceptor.js';

import {
  PlanUsageService,
} from './plan-usage.service.js';

import {
  UsageLimitsService,
} from './usage-limits.service.js';

import {
  WorkspaceUsageDaily,
} from './workspace-usage-daily.entity.js';

import {
  WorkspaceSubscription,
} from './workspace-subscription.entity.js';

import {
  BillingWebhookEvent,
} from './billing-webhook-event.entity.js';

import {
  RazorpaySubscriptionController,
} from './razorpay-subscription.controller.js';

import {
  RazorpaySubscriptionService,
} from './razorpay-subscription.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Plan,

      PlanEntitlement,

      Workspace,

      Dataset,

      WorkspaceUsageDaily,

      WorkspaceSubscription,

      BillingWebhookEvent,
    ]),

    WorkspacesModule,
  ],

  controllers: [
    BillingController,

    BillingWebhookController,

    EntitlementsController,

    RazorpaySubscriptionController,
  ],

  providers: [
    BillingService,

    EntitlementsService,

    UsageLimitsService,

    PlanUsageService,

    RazorpaySubscriptionService,

    {
      provide:
        APP_INTERCEPTOR,

      useClass:
        PlanUsageInterceptor,
    },
  ],

  exports: [
    BillingService,

    EntitlementsService,

    UsageLimitsService,

    PlanUsageService,

    RazorpaySubscriptionService,
  ],
})
export class BillingModule {}