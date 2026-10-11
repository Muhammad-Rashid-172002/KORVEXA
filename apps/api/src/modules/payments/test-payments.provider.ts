import { Inject, Injectable } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { ENV, type ApiEnv } from '../../config/env';
import {
  InvalidWebhookSignatureError,
  PaymentsProvider,
  type CheckoutRequest,
  type CheckoutSession,
  type ParsedEvent,
} from './payments.provider';

export const TEST_SIGNATURE_HEADER = 'x-test-signature';
const TOLERANCE_SECONDS = 300;

/**
 * Built-in simulated provider: no network, no account. Checkout "redirects" to a local test page and the
 * result comes back as an HMAC-signed webhook, so the real webhook pipeline (signature → raw event store →
 * idempotent processing) runs exactly as it does for Stripe. Refused in production by the env schema.
 */
@Injectable()
export class TestPaymentsProvider extends PaymentsProvider {
  readonly name = 'test' as const;

  constructor(@Inject(ENV) private readonly env: ApiEnv) {
    super();
  }

  createCheckout(req: CheckoutRequest): Promise<CheckoutSession> {
    return Promise.resolve({
      providerRef: `test_${req.paymentId}`,
      url: `${this.env.WEB_URL}/pay/test/${req.paymentId}`,
    });
  }

  refund(input: { providerRef: string; amount: number; idempotencyKey: string }) {
    return Promise.resolve({ refundRef: `test_refund_${input.idempotencyKey}` });
  }

  /** Header value for a body: `t=<unix>,v1=<hex hmac of "t.body">` (same shape as Stripe's). */
  sign(body: string, now = Math.floor(Date.now() / 1000)): string {
    const v1 = createHmac('sha256', this.env.TEST_PAYMENTS_WEBHOOK_SECRET)
      .update(`${now}.${body}`)
      .digest('hex');
    return `t=${now},v1=${v1}`;
  }

  verifyAndParse(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): ParsedEvent {
    const header = headers[TEST_SIGNATURE_HEADER];
    const value = Array.isArray(header) ? header[0] : header;
    const parts = Object.fromEntries((value ?? '').split(',').map((p) => p.split('=') as [string, string]));
    const t = Number(parts.t);
    if (!value || !Number.isFinite(t) || !parts.v1) throw new InvalidWebhookSignatureError();
    if (Math.abs(Date.now() / 1000 - t) > TOLERANCE_SECONDS)
      throw new InvalidWebhookSignatureError('Timestamp outside tolerance');
    const expected = createHmac('sha256', this.env.TEST_PAYMENTS_WEBHOOK_SECRET)
      .update(`${t}.${rawBody.toString('utf8')}`)
      .digest();
    const given = Buffer.from(parts.v1, 'hex');
    if (given.length !== expected.length || !timingSafeEqual(given, expected))
      throw new InvalidWebhookSignatureError();

    return this.parseStored(JSON.parse(rawBody.toString('utf8')));
  }

  parseStored(payload: unknown): ParsedEvent {
    const body = payload as {
      id: string;
      type: string;
      paymentId?: string;
      amount?: number;
      failureReason?: string;
    };
    const type =
      body.type === 'payment.succeeded' || body.type === 'payment.failed' ? body.type : ('ignored' as const);
    return {
      eventId: body.id,
      type,
      paymentId: body.paymentId,
      amount: body.amount,
      failureReason: body.failureReason,
      raw: body,
    };
  }
}
