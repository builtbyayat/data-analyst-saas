import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';

import Razorpay from 'razorpay';

import {
  Repository,
} from 'typeorm';

import {
  WorkspaceSubscription,
} from './workspace-subscription.entity.js';

import {
  Workspace,
} from '../workspaces/workspace.entity.js';

import {
  WorkspaceAccessService,
} from '../workspaces/workspace-access.service.js';

@Injectable()
export class RazorpaySubscriptionService {
  constructor(
    @InjectRepository(
      WorkspaceSubscription,
    )
    private readonly subscriptionRepository:
      Repository<WorkspaceSubscription>,

    @InjectRepository(
      Workspace,
    )
    private readonly workspaceRepository:
      Repository<Workspace>,

    private readonly workspaceAccessService:
      WorkspaceAccessService,
  ) {}

  async createProSubscription(
    userId: string,
    workspaceId: string,
  ) {
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

    if (
      workspace.planCode ===
      'pro'
    ) {
      throw new ConflictException(
        'Workspace is already on the Pro plan',
      );
    }

    const existing =
      await this.subscriptionRepository.findOne({
        where: {
          workspaceId,
        },
      });

    if (
      existing &&
      !this.isTerminalStatus(
        existing.status,
      )
    ) {
      if (
        existing.shortUrl
      ) {
        return {
          subscriptionId:
            existing.providerSubscriptionId,
          status:
            existing.status,
          shortUrl:
            existing.shortUrl,
          reused: true,
        };
      }

      throw new ConflictException(
        'A Razorpay subscription is already being created for this workspace',
      );
    }

    const keyId =
      this.getRequiredEnv(
        'RAZORPAY_KEY_ID',
      );

    const keySecret =
      this.getRequiredEnv(
        'RAZORPAY_KEY_SECRET',
      );

    const planId =
      this.getRequiredEnv(
        'RAZORPAY_PRO_PLAN_ID',
      );

    const totalCount =
      this.getPositiveIntegerEnv(
        'RAZORPAY_PRO_TOTAL_COUNT',
        12,
      );

    const razorpay =
      new Razorpay({
        key_id: keyId,
        key_secret: keySecret,
      });

    const created =
      await razorpay.subscriptions.create({
        plan_id:
          planId,

        total_count:
          totalCount,

        quantity:
          1,

        customer_notify:
          false,

        notes: {
          workspaceId,
          userId,
          planCode:
            'pro',
        },
      });

    const providerSubscriptionId =
      this.requireString(
        created.id,
        'Razorpay did not return a subscription ID',
      );

    const status =
      this.stringOrFallback(
        created.status,
        'created',
      );

    const shortUrl =
      this.nullableString(
        created.short_url,
      );

    const providerCustomerId =
      this.nullableString(
        created.customer_id,
      );

    const currentStart =
      this.timestampToDate(
        created.current_start,
      );

    const currentEnd =
      this.timestampToDate(
        created.current_end,
      );

    const entity =
      this.subscriptionRepository.create({
        workspaceId,

        provider:
          'razorpay',

        providerCustomerId,

        providerSubscriptionId,

        providerPlanId:
          planId,

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

    try {
      const saved =
        await this.subscriptionRepository.save(
          entity,
        );

      return {
        subscriptionId:
          saved.providerSubscriptionId,

        status:
          saved.status,

        shortUrl:
          saved.shortUrl,

        reused: false,
      };
    } catch (
      error
    ) {
      /*
       * The Razorpay subscription was already created
       * remotely. We surface the persistence problem
       * instead of pretending creation failed.
       */
      throw error;
    }
  }

  private isTerminalStatus(
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
      process.env[
        name
      ]?.trim();

    if (!value) {
      throw new ConflictException(
        `${name} is not configured`,
      );
    }

    return value;
  }

  private getPositiveIntegerEnv(
    name: string,
    fallback: number,
  ): number {
    const raw =
      process.env[
        name
      ]?.trim();

    if (!raw) {
      return fallback;
    }

    const parsed =
      Number(raw);

    if (
      !Number.isInteger(
        parsed,
      ) ||
      parsed <= 0
    ) {
      throw new ConflictException(
        `${name} must be a positive integer`,
      );
    }

    return parsed;
  }

  private requireString(
    value: unknown,
    message: string,
  ): string {
    if (
      typeof value !==
        'string' ||
      !value.trim()
    ) {
      throw new ConflictException(
        message,
      );
    }

    return value.trim();
  }

  private nullableString(
    value: unknown,
  ): string | null {
    if (
      typeof value !==
      'string'
    ) {
      return null;
    }

    const normalized =
      value.trim();

    return normalized ||
      null;
  }

  private stringOrFallback(
    value: unknown,
    fallback: string,
  ): string {
    if (
      typeof value ===
        'string' &&
      value.trim()
    ) {
      return value.trim();
    }

    return fallback;
  }

  private timestampToDate(
    value: unknown,
  ): Date | null {
    if (
      typeof value !==
        'number' ||
      !Number.isFinite(
        value,
      )
    ) {
      return null;
    }

    return new Date(
      value * 1000,
    );
  }
}