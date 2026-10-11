import { Logger } from '@nestjs/common';
import webpush from 'web-push';
import type { ApiEnv } from '../../config/env';

export interface PushTarget {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushPayload {
  title: string;
  body: string | null;
  url: string | null;
}

/** Outcome per subscription; `gone` means the browser unsubscribed and the row should be deleted. */
export type PushResult = 'sent' | 'gone' | 'failed';

export abstract class PushSender {
  abstract readonly enabled: boolean;
  abstract send(target: PushTarget, payload: PushPayload): Promise<PushResult>;
}

/** Web Push (VAPID). Disabled (no-op) until VAPID keys are configured. NOT yet verified in a real browser. */
export class WebPushSender extends PushSender {
  private readonly logger = new Logger(WebPushSender.name);
  readonly enabled: boolean;

  constructor(
    env: ApiEnv,
    private readonly lib: Pick<typeof webpush, 'sendNotification' | 'setVapidDetails'> = webpush,
  ) {
    super();
    this.enabled = Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
    if (this.enabled)
      this.lib.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY!, env.VAPID_PRIVATE_KEY!);
  }

  async send(target: PushTarget, payload: PushPayload): Promise<PushResult> {
    if (!this.enabled) return 'failed';
    try {
      await this.lib.sendNotification(
        { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
        JSON.stringify(payload),
        { TTL: 60 * 60 },
      );
      return 'sent';
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) return 'gone';
      this.logger.warn(`push failed (${status ?? 'unknown'})`);
      return 'failed';
    }
  }
}
