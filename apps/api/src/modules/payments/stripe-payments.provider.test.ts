import Stripe from 'stripe';
import { describe, expect, it } from 'vitest';
import type { ApiEnv } from '../../config/env';
import { InvalidWebhookSignatureError } from './payments.provider';
import { StripePaymentsProvider } from './stripe-payments.provider';

const SECRET = 'whsec_test_secret_for_unit_tests';
const env = { STRIPE_SECRET_KEY: 'sk_test_unit', STRIPE_WEBHOOK_SECRET: SECRET } as ApiEnv;
const provider = new StripePaymentsProvider(env);
const stripe = new Stripe('sk_test_unit');

const event = (type: string, object: Record<string, unknown>) =>
  JSON.stringify({ id: `evt_${type}`, object: 'event', type, data: { object } });
const sign = (payload: string, secret = SECRET) =>
  stripe.webhooks.generateTestHeaderString({ payload, secret });

describe('StripePaymentsProvider webhooks (no network)', () => {
  it('verifies the signature and maps a paid checkout session to payment.succeeded', () => {
    const payload = event('checkout.session.completed', {
      id: 'cs_1',
      payment_status: 'paid',
      client_reference_id: 'pay-123',
      amount_total: 31_500,
    });
    const parsed = provider.verifyAndParse(Buffer.from(payload), { 'stripe-signature': sign(payload) });
    expect(parsed).toMatchObject({
      type: 'payment.succeeded',
      paymentId: 'pay-123',
      amount: 31_500,
      eventId: 'evt_checkout.session.completed',
    });
  });

  it('ignores completed sessions that are not actually paid yet', () => {
    const payload = event('checkout.session.completed', {
      id: 'cs_1',
      payment_status: 'unpaid',
      client_reference_id: 'p',
    });
    expect(provider.verifyAndParse(Buffer.from(payload), { 'stripe-signature': sign(payload) }).type).toBe(
      'ignored',
    );
  });

  it('maps expired sessions to payment.failed and unknown events to ignored', () => {
    const expired = event('checkout.session.expired', { id: 'cs_1', client_reference_id: 'pay-9' });
    expect(
      provider.verifyAndParse(Buffer.from(expired), { 'stripe-signature': sign(expired) }),
    ).toMatchObject({
      type: 'payment.failed',
      paymentId: 'pay-9',
    });
    const other = event('customer.created', { id: 'cus_1' });
    expect(provider.verifyAndParse(Buffer.from(other), { 'stripe-signature': sign(other) }).type).toBe(
      'ignored',
    );
  });

  it('rejects a missing, forged, wrong-secret or tampered signature', () => {
    const payload = event('checkout.session.completed', {
      id: 'cs_1',
      payment_status: 'paid',
      client_reference_id: 'p',
      amount_total: 1,
    });
    const body = Buffer.from(payload);
    expect(() => provider.verifyAndParse(body, {})).toThrow(InvalidWebhookSignatureError);
    expect(() => provider.verifyAndParse(body, { 'stripe-signature': 't=1,v1=abc' })).toThrow(
      InvalidWebhookSignatureError,
    );
    expect(() => provider.verifyAndParse(body, { 'stripe-signature': sign(payload, 'whsec_other') })).toThrow(
      InvalidWebhookSignatureError,
    );
    const tampered = Buffer.from(payload.replace('"amount_total":1', '"amount_total":1000000'));
    expect(() => provider.verifyAndParse(tampered, { 'stripe-signature': sign(payload) })).toThrow(
      InvalidWebhookSignatureError,
    );
  });

  it('re-derives events from stored payloads for admin replay', () => {
    const stored = JSON.parse(
      event('checkout.session.completed', {
        id: 'cs_1',
        payment_status: 'paid',
        client_reference_id: 'pay-5',
        amount_total: 700,
      }),
    );
    expect(provider.parseStored(stored)).toMatchObject({
      type: 'payment.succeeded',
      paymentId: 'pay-5',
      amount: 700,
    });
  });
});
