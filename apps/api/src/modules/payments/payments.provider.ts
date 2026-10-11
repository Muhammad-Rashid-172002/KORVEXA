export interface CheckoutRequest {
  paymentId: string;
  /** Total the buyer pays, minor units (milestone price + buyer fee). */
  amount: number;
  currency: string;
  description: string;
  customerEmail: string;
  successUrl: string;
  cancelUrl: string;
  idempotencyKey: string;
}

export interface CheckoutSession {
  providerRef: string;
  url: string;
}

export type ParsedEventType = 'payment.succeeded' | 'payment.failed' | 'ignored';

export interface ParsedEvent {
  eventId: string;
  type: ParsedEventType;
  /** Our payment id, carried in provider metadata. */
  paymentId?: string;
  /** Total the provider says was charged (minor units). */
  amount?: number;
  failureReason?: string;
  raw: unknown;
}

export class InvalidWebhookSignatureError extends Error {
  constructor(message = 'Invalid webhook signature') {
    super(message);
    this.name = 'InvalidWebhookSignatureError';
  }
}

/**
 * Money-in provider (DECISIONS D-020). Adapters: `stripe` (test keys) and `test` (built-in simulation for
 * local dev and CI). Everything the app knows about a charge arrives through `verifyAndParse`; the success
 * redirect is never trusted.
 */
export abstract class PaymentsProvider {
  abstract readonly name: 'stripe' | 'test';
  abstract createCheckout(req: CheckoutRequest): Promise<CheckoutSession>;
  abstract refund(input: {
    providerRef: string;
    amount: number;
    idempotencyKey: string;
  }): Promise<{ refundRef: string }>;
  /** Throws InvalidWebhookSignatureError when the signature does not verify. */
  /** Re-derives the parsed event from a stored raw payload (admin replay; signature was verified on receipt). */
  abstract parseStored(payload: unknown): ParsedEvent;
  abstract verifyAndParse(
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
  ): ParsedEvent;
}
