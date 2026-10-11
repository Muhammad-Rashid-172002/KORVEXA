import {
  and,
  desc,
  eq,
  inArray,
  isNull,
  lt,
  notificationPreferences,
  notifications,
  profiles,
  pushSubscriptions,
  sql,
  users,
  type DbClient,
} from '@glasswork/db';
import { NOTIFICATION_TYPES, type NotificationType, type NotificationView } from '@glasswork/shared';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ENV, type ApiEnv } from '../../config/env';
import type { EmailQueue } from '../../infra/infra.module';
import { DB, EMAIL_QUEUE } from '../../infra/tokens';
import { RealtimeService } from '../realtime/realtime.service';
import { PushSender } from './push.sender';

export interface NotifyInput {
  type: NotificationType;
  title: string;
  body?: string | null;
  /** In-app path, e.g. /projects/:id */
  url?: string;
  payload?: Record<string, unknown>;
  /**
   * When set, an existing UNREAD notification with the same key is updated instead of adding another row
   * (keeps a busy chat from flooding the inbox).
   */
  collapseKey?: string;
}

const toView = (n: typeof notifications.$inferSelect): NotificationView => ({
  id: n.id,
  type: n.type,
  title: n.title,
  body: n.body,
  url: n.url,
  readAt: n.readAt?.toISOString() ?? null,
  createdAt: n.createdAt.toISOString(),
});

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @Inject(DB) private readonly db: DbClient,
    @Inject(ENV) private readonly env: ApiEnv,
    @Inject(EMAIL_QUEUE) private readonly emailQueue: EmailQueue,
    private readonly realtime: RealtimeService,
    private readonly push: PushSender,
  ) {}

  /**
   * Fans one event out to each recipient according to THEIR per-type preferences: in-app row (+ realtime
   * push to open tabs), email through the queue, and web push. A failure in one channel never blocks the others.
   */
  async notify(userIds: string[], n: NotifyInput): Promise<void> {
    const ids = [...new Set(userIds)];
    if (!ids.length) return;
    const def = NOTIFICATION_TYPES[n.type].defaults;
    const prefs = await this.db.db
      .select()
      .from(notificationPreferences)
      .where(and(inArray(notificationPreferences.userId, ids), eq(notificationPreferences.type, n.type)));
    const people = await this.db.db
      .select({ id: users.id, email: users.email, verified: users.emailVerified, name: profiles.displayName })
      .from(users)
      .innerJoin(profiles, eq(profiles.userId, users.id))
      .where(inArray(users.id, ids));

    for (const uid of ids) {
      const p = prefs.find((x) => x.userId === uid);
      const want = { inApp: p?.inApp ?? def.inApp, email: p?.email ?? def.email, push: p?.push ?? def.push };
      const person = people.find((x) => x.id === uid);
      try {
        if (want.inApp) await this.inApp(uid, n);
        if (want.email && person?.verified) {
          await this.emailQueue.add('notification', {
            template: 'notification',
            to: person.email,
            data: {
              name: person.name,
              title: n.title,
              body: n.body ?? null,
              url: `${this.env.WEB_URL}${n.url ?? '/dashboard'}`,
            },
          });
        }
        if (want.push) await this.sendPush(uid, n);
      } catch (err) {
        this.logger.error({ err, uid, type: n.type }, 'notification delivery failed');
      }
    }
  }

  private async inApp(userId: string, n: NotifyInput) {
    let row: typeof notifications.$inferSelect | undefined;
    if (n.collapseKey) {
      [row] = await this.db.db
        .update(notifications)
        .set({ title: n.title, body: n.body ?? null, createdAt: new Date() })
        .where(
          and(
            eq(notifications.userId, userId),
            eq(notifications.type, n.type),
            isNull(notifications.readAt),
            sql`${notifications.payload}->>'collapseKey' = ${n.collapseKey}`,
          ),
        )
        .returning();
    }
    if (!row) {
      [row] = await this.db.db
        .insert(notifications)
        .values({
          userId,
          type: n.type,
          title: n.title,
          body: n.body ?? null,
          url: n.url ?? null,
          payload: { ...(n.payload ?? {}), ...(n.collapseKey && { collapseKey: n.collapseKey }) },
        })
        .returning();
    }
    if (row) this.realtime.toUser(userId, 'notification:new', toView(row));
  }

  private async sendPush(userId: string, n: NotifyInput) {
    if (!this.push.enabled) return;
    const subs = await this.db.db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, userId));
    for (const s of subs) {
      const res = await this.push.send(
        { endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth },
        { title: n.title, body: n.body ?? null, url: n.url ? `${this.env.WEB_URL}${n.url}` : null },
      );
      if (res === 'gone') await this.db.db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, s.id));
    }
  }

  // ---- inbox -------------------------------------------------------------------------

  async list(userId: string, cursor: string | undefined, limit: number) {
    const rows = await this.db.db
      .select()
      .from(notifications)
      .where(and(eq(notifications.userId, userId), cursor ? lt(notifications.id, cursor) : undefined))
      .orderBy(desc(notifications.id))
      .limit(limit + 1);
    const page = rows.slice(0, limit);
    return { items: page.map(toView), nextCursor: rows.length > limit ? (page.at(-1)?.id ?? null) : null };
  }

  async unreadCount(userId: string): Promise<number> {
    const [r] = await this.db.db
      .select({ n: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
    return r?.n ?? 0;
  }

  /** Marks the caller's own notifications read (all, or the given ids; other users' ids are simply ignored). */
  async markRead(userId: string, ids: string[] | 'all') {
    await this.db.db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(notifications.userId, userId),
          isNull(notifications.readAt),
          ids === 'all' ? undefined : inArray(notifications.id, ids),
        ),
      );
    return { unread: await this.unreadCount(userId) };
  }

  // ---- preferences & push subscriptions -------------------------------------------

  async getPreferences(userId: string) {
    const rows = await this.db.db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId));
    return (Object.keys(NOTIFICATION_TYPES) as NotificationType[]).map((type) => {
      const p = rows.find((r) => r.type === type);
      const d = NOTIFICATION_TYPES[type];
      return {
        type,
        label: d.label,
        inApp: p?.inApp ?? d.defaults.inApp,
        email: p?.email ?? d.defaults.email,
        push: p?.push ?? d.defaults.push,
      };
    });
  }

  async setPreferences(
    userId: string,
    prefs: { type: string; inApp: boolean; email: boolean; push: boolean }[],
  ) {
    const known = prefs.filter((p) => p.type in NOTIFICATION_TYPES);
    for (const p of known) {
      await this.db.db
        .insert(notificationPreferences)
        .values({ userId, type: p.type, inApp: p.inApp, email: p.email, push: p.push })
        .onConflictDoUpdate({
          target: [notificationPreferences.userId, notificationPreferences.type],
          set: { inApp: p.inApp, email: p.email, push: p.push },
        });
    }
    return this.getPreferences(userId);
  }

  async subscribePush(
    userId: string,
    sub: { endpoint: string; keys: { p256dh: string; auth: string } },
    userAgent?: string,
  ) {
    await this.db.db
      .insert(pushSubscriptions)
      .values({
        userId,
        endpoint: sub.endpoint,
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
        userAgent: userAgent ?? null,
      })
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        // Re-registering an endpoint moves it to the current user (a shared browser) and refreshes its keys.
        set: { userId, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
      });
    return { ok: true };
  }

  async unsubscribePush(userId: string, endpoint: string) {
    await this.db.db
      .delete(pushSubscriptions)
      .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)));
    return { ok: true };
  }
}
