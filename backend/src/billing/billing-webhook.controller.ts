import {
  Controller,
  Headers,
  HttpCode,
  Post,
  Req,
} from '@nestjs/common';

import type {
  RawBodyRequest,
} from '@nestjs/common';

import type {
  Request,
} from 'express';

import {
  BillingService,
} from './billing.service.js';

@Controller('billing')
export class BillingWebhookController {
  constructor(
    private readonly billingService: BillingService,
  ) {}

  @Post(
    'razorpay/webhook',
  )
  @HttpCode(200)
  async handleRazorpayWebhook(
    @Req()
    request: RawBodyRequest<Request>,

    @Headers(
      'x-razorpay-signature',
    )
    signature: string,

    @Headers(
      'x-razorpay-event-id',
    )
    eventId?: string,
  ) {
    const rawBody =
      request.rawBody;

    if (!rawBody) {
      return {
        received: false,

        message:
          'Raw request body is required',
      };
    }

    return this.billingService.handleRazorpayWebhook(
      rawBody.toString('utf8'),
      signature,
      eventId,
    );
  }
}