import { Inject, Injectable } from '@nestjs/common';
import Stripe from 'stripe';
import { ENV, type ApiEnv } from '../../config/env';
import {
  InvalidWebhookSignatureError,
  PaymentsProvider,
  type CheckoutRequest,
  type CheckoutSession,
  type ParsedEvent,
} from './payments.provider';

/**
 * Stripe adapter (Checkout Sessions, "separate charges and transfers": funds sit in the platform balance
 * until milestone release, D-020). Test keys only until PAYMENTS_LIVE_ENABLED. NOTE: createCheckout/refund
 * have not been exercised against Stripe's API yet (no keys); webhook signature handling is covered by tests.
 */
@Injectable()
export class StripePaymentsProvider extends PaymentsProvider {
  readonly name = 'stripe' as const;
  private readonly stripe: Stripe;

  constructor(@Inject(ENV) private readonly env: ApiEnv) {
    super();
    this.stripe = new Stripe(env.STRIPE_SECRET_KEY ?? 'sk_test_unconfigured');
  }

  async createCheckout(req: CheckoutRequest): Promise<CheckoutSession> {
    const session = await this.stripe.checkout.sessions.create(
      {
        mode: 'payment',
        customer_email: req.customerEmail,
        success_url: req.successUrl,
        cancel_url: req.cancelUrl,
        client_reference_id: req.paymentId,
        metadata: { paymentId: req.paymentId },
        payment_intent_data: { metadata: { paymentId: req.paymentId } },
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: req.currency.toLowerCase(),
              unit_amount: req.amount,
              product_data: { name: req.description },
            },
          },
        ],
      },
      { idempotencyKey: req.idempotencyKey },
    );
    if (!session.url) throw new Error('Stripe returned no checkout URL');
    return { providerRef: session.id, url: session.url };
  }

  async refund(input: { providerRef: string; amount: number; idempotencyKey: string }) {
    const session = await this.stripe.checkout.sessions.retrieve(input.providerRef);
    const paymentIntent =
      typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id;
    if (!paymentIntent) throw new Error('Checkout session has no payment intent to refund');
    const refund = await this.stripe.refunds.create(
      { payment_intent: paymentIntent, amount: input.amount },
      { idempotencyKey: input.idempotencyKey },
    );
    return { refundRef: refund.id };
  }

  verifyAndParse(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): ParsedEvent {
    const sig = headers['stripe-signature'];
    const header = Array.isArray(sig) ? sig[0] : sig;
    let event: Stripe.Event;
    try {
      if (!header || !this.env.STRIPE_WEBHOOK_SECRET) throw new Error('missing signature or secret');
      event = this.stripe.webhooks.constructEvent(rawBody, header, this.env.STRIPE_WEBHOOK_SECRET);
    } catch {
      throw new InvalidWebhookSignatureError();
    }
    return this.map(event);
  }

  parseStored(payload: unknown): ParsedEvent {
    return this.map(payload as Stripe.Event);
  }

  private map(event: Stripe.Event): ParsedEvent {
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded': {
        const s = event.data.object;
        if (s.payment_status !== 'paid') return { eventId: event.id, type: 'ignored', raw: event };
        return {
          eventId: event.id,
          type: 'payment.succeeded',
          paymentId: s.client_reference_id ?? s.metadata?.paymentId,
          amount: s.amount_total ?? undefined,
          raw: event,
        };
      }
      case 'checkout.session.expired':
      case 'checkout.session.async_payment_failed': {
        const s = event.data.object;
        return {
          eventId: event.id,
          type: 'payment.failed',
          paymentId: s.client_reference_id ?? s.metadata?.paymentId,
          failureReason: event.type,
          raw: event,
        };
      }
      default:
        return { eventId: event.id, type: 'ignored', raw: event };
    }
  }
}
