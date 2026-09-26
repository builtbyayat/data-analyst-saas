import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';

import {
  QueryFailedError,
  Repository,
} from 'typeorm';

import {
  createHash,
  createHmac,
  timingSafeEqual,
} from 'node:crypto';

import Razorpay from 'razorpay';

import { Plan } from './plan.entity.js';

import { WorkspaceSubscription } from './workspace-subscription.entity.js';

import { BillingWebhookEvent } from './billing-webhook-event.entity.js';

import { Workspace } from '../workspaces/workspace.entity.js';

import { WorkspaceAccessService } from '../workspaces/workspace-access.service.js';

export interface WorkspacePlanResponse {
  workspaceId: string;

  plan: {
    id: string;

    code: string;

    name: string;

    description: string | null;

    aiQueriesPerDay: number;

    sqlExecutionsPerDay: number;

    datasetLimit: number;

    storageLimitBytes: number;

    maxFileSizeBytes: number;
  };

  subscription: {
    provider: string;

    providerSubscriptionId: string | null;

    status: string;

    currentStart: string | null;

    currentEnd: string | null;

    cancelAtPeriodEnd: boolean;
  } | null;
}

export interface CreateProSubscriptionResponse {
  workspaceId: string;

  planCode: string;

  provider: 'razorpay';

  subscriptionId: string;

  status: string;

  shortUrl: string | null;

  keyId: string;
}

export interface CancelProSubscriptionResponse {
  workspaceId: string;

  subscriptionId: string;

  status: string;

  cancelAtPeriodEnd: boolean;
}

interface RazorpaySubscriptionPayload {
  id?: unknown;

  status?: unknown;

  plan_id?: unknown;

  customer_id?: unknown;

  short_url?: unknown;

  current_start?: unknown;

  current_end?: unknown;

  charge_at?: unknown;

  notes?: unknown;
}

interface RazorpaySubscriptionEventPayload {
  subscription?: {
    entity?: RazorpaySubscriptionPayload;
  };
}

interface RazorpayWebhookBody {
  event?: unknown;

  payload?: RazorpaySubscriptionEventPayload;
}

@Injectable()
export class BillingService {
  private readonly razorpay: Razorpay;

  constructor(
    @InjectRepository(Plan)
    private readonly planRepository: Repository<Plan>,

    @InjectRepository(Workspace)
    private readonly workspaceRepository: Repository<Workspace>,

    @InjectRepository(WorkspaceSubscription)
    private readonly workspaceSubscriptionRepository: Repository<WorkspaceSubscription>,

    @InjectRepository(BillingWebhookEvent)
    private readonly billingWebhookEventRepository: Repository<BillingWebhookEvent>,

    private readonly workspaceAccessService: WorkspaceAccessService,
  ) {
    const keyId =
      process.env.RAZORPAY_KEY_ID?.trim();

    const keySecret =
      process.env.RAZORPAY_KEY_SECRET?.trim();

    if (
      !keyId ||
      !keySecret
    ) {
      throw new Error(
        'RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be configured',
      );
    }

    this.razorpay =
      new Razorpay({
        key_id: keyId,
        key_secret: keySecret,
      });
  }

  async getCurrentPlan(
    userId: string,
    workspaceId: string,
  ): Promise<WorkspacePlanResponse> {
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

    const plan =
      await this.planRepository.findOne({
        where: {
          id: workspace.plan.id,
        },
      });

    if (!plan) {
      throw new NotFoundException(
        'Workspace plan was not found',
      );
    }

    const subscription =
      await this.workspaceSubscriptionRepository.findOne({
        where: {
          workspaceId,
        },
      });

    return {
      workspaceId,

      plan: {
        id: plan.id,

        code: plan.code,

        name: plan.name,

        description:
          plan.description,

        aiQueriesPerDay:
          plan.aiQueriesPerDay,

        sqlExecutionsPerDay:
          plan.sqlExecutionsPerDay,

        datasetLimit:
          plan.datasetLimit,

        storageLimitBytes:
          plan.storageLimitBytes,

        maxFileSizeBytes:
          plan.maxFileSizeBytes,
      },

      subscription:
        subscription
          ? {
              provider:
                subscription.provider,

              providerSubscriptionId:
                subscription.providerSubscriptionId,

              status:
                subscription.status,

              currentStart:
                subscription.currentStart
                  ? subscription.currentStart.toISOString()
                  : null,

              currentEnd:
                subscription.currentEnd
                  ? subscription.currentEnd.toISOString()
                  : null,

              cancelAtPeriodEnd:
                subscription.cancelAtPeriodEnd,
            }
          : null,
    };
  }

  async createProSubscription(
    userId: string,
    workspaceId: string,
  ): Promise<CreateProSubscriptionResponse> {
    await this.workspaceAccessService.requireMembership(
      userId,
      workspaceId,
    );

    const workspace =
      await this.workspaceRepository.findOne({
        where: {
          id: workspaceId,
        },
      });

    if (!workspace) {
      throw new NotFoundException(
        'Workspace not found',
      );
    }

    if (
      workspace.planCode ===
      'pro'
    ) {
      throw new ConflictException(
        'Workspace is already on the Pro plan',
      );
    }

    const existingSubscription =
      await this.workspaceSubscriptionRepository.findOne({
        where: {
          workspaceId,
        },
      });

    if (
      existingSubscription &&
      !this.isTerminalSubscriptionStatus(
        existingSubscription.status,
      )
    ) {
      return {
        workspaceId,

        planCode:
          existingSubscription.planCode,

        provider: 'razorpay',

        subscriptionId:
          existingSubscription.providerSubscriptionId!,

        status:
          existingSubscription.status,

        shortUrl:
          existingSubscription.shortUrl,

        keyId:
          this.getRequiredEnv(
            'RAZORPAY_KEY_ID',
          ),
      };
    }

    const razorpayPlanId =
      this.getRequiredEnv(
        'RAZORPAY_PRO_PLAN_ID',
      );

    const totalCount =
      this.getRequiredPositiveIntegerEnv(
        'RAZORPAY_PRO_TOTAL_COUNT',
      );

    const subscriptionResponse =
      await this.razorpay.subscriptions.create(
        {
          plan_id:
            razorpayPlanId,

          total_count:
            totalCount,

          quantity:
            1,

          customer_notify:
            true,

          notes: {
            workspaceId,

            planCode:
              'pro',
          },
        } as any,
      );

    const razorpaySubscription =
      subscriptionResponse as unknown as RazorpaySubscriptionPayload;

    const providerSubscriptionId =
      this.requireString(
        razorpaySubscription.id,
        'Razorpay did not return a subscription ID',
      );

    const status =
      this.stringOrFallback(
        razorpaySubscription.status,
        'created',
      );

    const shortUrl =
      this.nullableString(
        razorpaySubscription.short_url,
      );

    if (!shortUrl) {
      throw new Error(
        'Razorpay did not return a subscription URL',
      );
    }

    const currentStart =
      this.timestampToDate(
        razorpaySubscription.current_start,
      );

    const currentEnd =
      this.timestampToDate(
        razorpaySubscription.current_end,
      );

    const customerId =
      this.nullableString(
        razorpaySubscription.customer_id,
      );

    const subscription =
      this.workspaceSubscriptionRepository.create({
        workspaceId,

        provider:
          'razorpay',

        providerCustomerId:
          customerId,

        providerSubscriptionId,

        providerPlanId:
          razorpayPlanId,

        planCode:
          'pro',

        status,

        shortUrl,

        currentStart,

        currentEnd,

        cancelAtPeriodEnd:
          false,

        lastPaymentAt:
          null,
      });

    await this.workspaceSubscriptionRepository.save(
      subscription,
    );

    return {
      workspaceId,

      planCode:
        'pro',

      provider:
        'razorpay',

      subscriptionId:
        providerSubscriptionId,

      status,

      shortUrl,

      keyId:
        this.getRequiredEnv(
          'RAZORPAY_KEY_ID',
        ),
    };
  }

  async cancelProSubscription(
    userId: string,
    workspaceId: string,
  ): Promise<CancelProSubscriptionResponse> {
    await this.workspaceAccessService.requireMembership(
      userId,
      workspaceId,
    );

    const subscription =
      await this.workspaceSubscriptionRepository.findOne({
        where: {
          workspaceId,
        },
      });

    if (!subscription) {
      throw new NotFoundException(
        'No Razorpay subscription was found for this workspace',
      );
    }

    if (
      !subscription.providerSubscriptionId
    ) {
      throw new ConflictException(
        'Workspace subscription is missing the Razorpay subscription ID',
      );
    }

    if (
      this.isTerminalSubscriptionStatus(
        subscription.status,
      )
    ) {
      return {
        workspaceId,

        subscriptionId:
          subscription.providerSubscriptionId,

        status:
          subscription.status,

        cancelAtPeriodEnd:
          subscription.cancelAtPeriodEnd,
      };
    }

    const response =
      await this.razorpay.subscriptions.cancel(
        subscription.providerSubscriptionId,
        {
          cancel_at_cycle_end:
            true,
        } as any,
      );

    const razorpaySubscription =
      response as unknown as RazorpaySubscriptionPayload;

    const status =
      this.stringOrFallback(
        razorpaySubscription.status,
        subscription.status,
      );

    subscription.status =
      status;

    subscription.cancelAtPeriodEnd =
      true;

    subscription.currentStart =
      this.timestampToDate(
        razorpaySubscription.current_start,
      ) ??
      subscription.currentStart;

    subscription.currentEnd =
      this.timestampToDate(
        razorpaySubscription.current_end,
      ) ??
      subscription.currentEnd;

    await this.workspaceSubscriptionRepository.save(
      subscription,
    );

    return {
      workspaceId,

      subscriptionId:
        subscription.providerSubscriptionId,

      status:
        subscription.status,

      cancelAtPeriodEnd:
        subscription.cancelAtPeriodEnd,
    };
  }

  async handleRazorpayWebhook(
    rawBody: string,
    signature: string,
    eventIdHeader?: string,
  ): Promise<{
    received: true;
    duplicate?: boolean;
  }> {
    this.verifyWebhookSignature(
      rawBody,
      signature,
    );

    let body:
      RazorpayWebhookBody;

    try {
      body =
        JSON.parse(
          rawBody,
        ) as RazorpayWebhookBody;
    } catch {
      throw new ConflictException(
        'Razorpay webhook body is not valid JSON',
      );
    }

    const eventType =
      this.requireString(
        body.event,
        'Razorpay webhook event is missing',
      );

    const eventId =
      eventIdHeader?.trim() ||
      createHash('sha256')
        .update(rawBody)
        .digest('hex');

    try {
      await this.billingWebhookEventRepository.insert({
        provider:
          'razorpay',

        eventId,

        eventType,

        processedAt:
          null,
      });
    } catch (error) {
      if (
        this.isUniqueViolation(error)
      ) {
        return {
          received: true,

          duplicate: true,
        };
      }

      throw error;
    }

    const subscriptionEntity =
      body.payload
        ?.subscription
        ?.entity;

    if (!subscriptionEntity) {
      await this.markWebhookProcessed(
        eventId,
      );

      return {
        received: true,
      };
    }

    const providerSubscriptionId =
      this.nullableString(
        subscriptionEntity.id,
      );

    if (!providerSubscriptionId) {
      await this.markWebhookProcessed(
        eventId,
      );

      return {
        received: true,
      };
    }

    const subscription =
      await this.workspaceSubscriptionRepository.findOne({
        where: {
          providerSubscriptionId,
        },
      });

    if (!subscription) {
      await this.markWebhookProcessed(
        eventId,
      );

      return {
        received: true,
      };
    }

    const providerStatus =
      this.stringOrFallback(
        subscriptionEntity.status,
        subscription.status,
      );

    subscription.status =
      providerStatus;

    subscription.providerCustomerId =
      this.nullableString(
        subscriptionEntity.customer_id,
      ) ??
      subscription.providerCustomerId;

    subscription.providerPlanId =
      this.nullableString(
        subscriptionEntity.plan_id,
      ) ??
      subscription.providerPlanId;

    subscription.shortUrl =
      this.nullableString(
        subscriptionEntity.short_url,
      ) ??
      subscription.shortUrl;

    subscription.currentStart =
      this.timestampToDate(
        subscriptionEntity.current_start,
      ) ??
      subscription.currentStart;

    subscription.currentEnd =
      this.timestampToDate(
        subscriptionEntity.current_end,
      ) ??
      subscription.currentEnd;

    const eventIndicatesActivation =
      eventType ===
        'subscription.activated' ||
      eventType ===
        'subscription.resumed' ||
      eventType ===
        'subscription.charged';

    const eventIndicatesFailure =
      eventType ===
        'subscription.halted' ||
      eventType ===
        'subscription.cancelled' ||
      eventType ===
        'subscription.completed' ||
      eventType ===
        'subscription.expired';

    if (
      eventIndicatesActivation ||
      providerStatus ===
        'active'
    ) {
      await this.activateWorkspacePro(
        subscription.workspaceId,
      );
    }

    if (
      eventIndicatesFailure
    ) {
      await this.deactivateWorkspaceToFree(
        subscription.workspaceId,
      );
    }

    const paymentTimestamp =
      this.timestampToDate(
        subscriptionEntity.charge_at,
      );

    if (paymentTimestamp) {
      subscription.lastPaymentAt =
        paymentTimestamp;
    }

    await this.workspaceSubscriptionRepository.save(
      subscription,
    );

    await this.markWebhookProcessed(
      eventId,
    );

    return {
      received: true,
    };
  }

  private async activateWorkspacePro(
    workspaceId: string,
  ): Promise<void> {
    await this.workspaceRepository.update(
      {
        id: workspaceId,
      },
      {
        planCode:
          'pro',
      },
    );
  }

  private async deactivateWorkspaceToFree(
    workspaceId: string,
  ): Promise<void> {
    await this.workspaceRepository.update(
      {
        id: workspaceId,
      },
      {
        planCode:
          'free',
      },
    );
  }

  private async markWebhookProcessed(
    eventId: string,
  ): Promise<void> {
    await this.billingWebhookEventRepository.update(
      {
        provider:
          'razorpay',

        eventId,
      },
      {
        processedAt:
          new Date(),
      },
    );
  }

private verifyWebhookSignature(
  rawBody: string,
  signature: string,
): void {
  const secret =
    this.getRequiredEnv(
      'RAZORPAY_WEBHOOK_SECRET',
    );

  const expectedHex =
    createHmac(
      'sha256',
      secret,
    )
      .update(
        rawBody,
        'utf8',
      )
      .digest('hex');

  const actualBuffer =
    Buffer.from(
      signature.trim(),
      'hex',
    );

  const expectedBuffer =
    Buffer.from(
      expectedHex,
      'hex',
    );

  if (
    actualBuffer.length !==
    expectedBuffer.length
  ) {
    throw new ConflictException(
      'Invalid Razorpay webhook signature',
    );
  }

  if (
    !timingSafeEqual(
      actualBuffer,
      expectedBuffer,
    )
  ) {
    throw new ConflictException(
      'Invalid Razorpay webhook signature',
    );
  }
}

  private isTerminalSubscriptionStatus(
    status: string,
  ): boolean {
    return (
      status ===
        'cancelled' ||
      status ===
        'completed' ||
      status ===
        'expired' ||
      status ===
        'halted'
    );
  }

  private getRequiredEnv(
    name: string,
  ): string {
    const value =
      process.env[name]?.trim();

    if (!value) {
      throw new Error(
        `${name} must be configured`,
      );
    }

    return value;
  }

  private getRequiredPositiveIntegerEnv(
    name: string,
  ): number {
    const value =
      Number.parseInt(
        this.getRequiredEnv(name),
        10,
      );

    if (
      !Number.isInteger(value) ||
      value <= 0
    ) {
      throw new Error(
        `${name} must be a positive integer`,
      );
    }

    return value;
  }

  private requireString(
    value: unknown,
    message: string,
  ): string {
    const normalized =
      this.nullableString(value);

    if (!normalized) {
      throw new ConflictException(
        message,
      );
    }

    return normalized;
  }

  private nullableString(
    value: unknown,
  ): string | null {
    return typeof value ===
      'string' &&
      value.trim()
      ? value.trim()
      : null;
  }

  private stringOrFallback(
    value: unknown,
    fallback: string,
  ): string {
    const normalized =
      this.nullableString(value);

    return normalized ??
      fallback;
  }

  private timestampToDate(
    value: unknown,
  ): Date | null {
    if (
      typeof value !==
        'number' &&
      typeof value !==
        'string'
    ) {
      return null;
    }

    const numeric =
      Number(value);

    if (
      !Number.isFinite(
        numeric,
      ) ||
      numeric <= 0
    ) {
      return null;
    }

    return new Date(
      numeric * 1000,
    );
  }

  private isUniqueViolation(
    error: unknown,
  ): boolean {
    return (
      error instanceof
        QueryFailedError &&
      (
        error.driverError as {
          code?: string;
        }
      )?.code ===
        '23505'
    );
  }
}