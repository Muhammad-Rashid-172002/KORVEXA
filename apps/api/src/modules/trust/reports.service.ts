import {
  and,
  auditLogs,
  conversationMembers,
  desc,
  eq,
  gt,
  messages,
  profiles,
  reports,
  reviews,
  services,
  sessions,
  sql,
  users,
  type DbClient,
} from '@glasswork/db';
import type { ReportTarget } from '@glasswork/shared';
import {
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { RequestActor } from '../../auth/session.service';
import { DB } from '../../infra/tokens';

const MAX_REPORTS_PER_HOUR = 10;

@Injectable()
export class ReportsService {
  constructor(@Inject(DB) private readonly db: DbClient) {}

  /** The reporter may only report things they can legitimately see; anything else looks like it doesn't exist. */
  private async validateTarget(actor: RequestActor, type: ReportTarget, id: string) {
    switch (type) {
      case 'user': {
        if (id === actor.userId) throw new UnprocessableEntityException('You cannot report yourself');
        const [u] = await this.db.db.select({ id: users.id }).from(users).where(eq(users.id, id));
        if (!u) throw new NotFoundException('Not found');
        return;
      }
      case 'service': {
        const [s] = await this.db.db
          .select({ sellerId: services.sellerId, status: services.status })
          .from(services)
          .where(eq(services.id, id));
        if (!s || s.status !== 'live') throw new NotFoundException('Not found');
        if (s.sellerId === actor.userId)
          throw new UnprocessableEntityException('You cannot report your own service');
        return;
      }
      case 'message': {
        const [m] = await this.db.db
          .select({ senderId: messages.senderId })
          .from(messages)
          .innerJoin(
            conversationMembers,
            and(
              eq(conversationMembers.conversationId, messages.conversationId),
              eq(conversationMembers.userId, actor.userId),
            ),
          )
          .where(eq(messages.id, id));
        if (!m) throw new NotFoundException('Not found');
        if (m.senderId === actor.userId)
          throw new UnprocessableEntityException('You cannot report your own message');
        return;
      }
      case 'review': {
        const [r] = await this.db.db
          .select({ authorId: reviews.authorId })
          .from(reviews)
          .where(and(eq(reviews.id, id), eq(reviews.visibility, 'public')));
        if (!r) throw new NotFoundException('Not found');
        if (r.authorId === actor.userId)
          throw new UnprocessableEntityException('You cannot report your own review');
        return;
      }
    }
  }

  async create(
    actor: RequestActor,
    input: { targetType: ReportTarget; targetId: string; reason: string; details?: string },
  ) {
    await this.validateTarget(actor, input.targetType, input.targetId);
    const [recent] = await this.db.db
      .select({ n: sql<number>`count(*)::int` })
      .from(reports)
      .where(
        and(eq(reports.reporterId, actor.userId), gt(reports.createdAt, new Date(Date.now() - 3_600_000))),
      );
    if ((recent?.n ?? 0) >= MAX_REPORTS_PER_HOUR)
      throw new HttpException('You are sending reports too quickly', HttpStatus.TOO_MANY_REQUESTS);
    const [dup] = await this.db.db
      .select({ id: reports.id })
      .from(reports)
      .where(
        and(
          eq(reports.reporterId, actor.userId),
          eq(reports.targetType, input.targetType),
          eq(reports.targetId, input.targetId),
          eq(reports.status, 'open'),
        ),
      );
    if (dup) throw new ConflictException('You already have an open report about this');
    const [row] = await this.db.db
      .insert(reports)
      .values({
        reporterId: actor.userId,
        targetType: input.targetType,
        targetId: input.targetId,
        reason: input.reason,
        details: input.details ?? null,
      })
      .returning({ id: reports.id });
    await this.db.db.insert(auditLogs).values({
      actorId: actor.userId,
      action: 'report.created',
      entityType: 'report',
      entityId: row!.id,
      after: { targetType: input.targetType, targetId: input.targetId },
    });
    return { id: row!.id, status: 'open' as const };
  }

  // ---- admin ---------------------------------------------------------------------------------------

  async queue(status: 'open' | 'actioned' | 'dismissed') {
    const rows = await this.db.db
      .select({ r: reports, reporter: profiles.displayName })
      .from(reports)
      .innerJoin(profiles, eq(profiles.userId, reports.reporterId))
      .where(eq(reports.status, status))
      .orderBy(desc(reports.id))
      .limit(100);
    const out = [];
    for (const { r, reporter } of rows)
      out.push({
        id: r.id,
        targetType: r.targetType,
        targetId: r.targetId,
        reason: r.reason,
        details: r.details,
        status: r.status,
        reporter,
        handledNote: r.handledNote,
        createdAt: r.createdAt.toISOString(),
        target: await this.describe(r.targetType, r.targetId),
      });
    return out;
  }

  private async describe(
    type: ReportTarget,
    id: string,
  ): Promise<{ label: string; ownerId: string | null; excerpt: string | null }> {
    if (type === 'user') {
      const [u] = await this.db.db
        .select({ name: profiles.displayName })
        .from(profiles)
        .where(eq(profiles.userId, id));
      return { label: u?.name ?? 'Unknown user', ownerId: id, excerpt: null };
    }
    if (type === 'service') {
      const [s] = await this.db.db
        .select({ title: services.title, sellerId: services.sellerId })
        .from(services)
        .where(eq(services.id, id));
      return { label: s?.title ?? 'Unknown service', ownerId: s?.sellerId ?? null, excerpt: null };
    }
    if (type === 'message') {
      const [m] = await this.db.db
        .select({ body: messages.body, senderId: messages.senderId, conversationId: messages.conversationId })
        .from(messages)
        .where(eq(messages.id, id));
      return { label: 'Chat message', ownerId: m?.senderId ?? null, excerpt: m?.body.slice(0, 300) ?? null };
    }
    const [r] = await this.db.db
      .select({ body: reviews.body, authorId: reviews.authorId })
      .from(reviews)
      .where(eq(reviews.id, id));
    return { label: 'Public review', ownerId: r?.authorId ?? null, excerpt: r?.body.slice(0, 300) ?? null };
  }

  async decide(admin: RequestActor, id: string, decision: 'actioned' | 'dismissed', note: string) {
    const upd = await this.db.db
      .update(reports)
      .set({ status: decision, handledBy: admin.userId, handledNote: note, handledAt: new Date() })
      .where(and(eq(reports.id, id), eq(reports.status, 'open')))
      .returning({ id: reports.id });
    if (!upd.length) throw new UnprocessableEntityException('Only an open report can be decided');
    await this.db.db.insert(auditLogs).values({
      actorId: admin.userId,
      action: `report.${decision}`,
      entityType: 'report',
      entityId: id,
      after: { note },
    });
    return { id, status: decision };
  }

  // ---- ban / takedown --------------------------------------------------------------------------------

  async ban(admin: RequestActor, userId: string, reason: string) {
    if (userId === admin.userId) throw new UnprocessableEntityException('You cannot ban yourself');
    const [u] = await this.db.db
      .select({ roles: users.roles, bannedAt: users.bannedAt })
      .from(users)
      .where(eq(users.id, userId));
    if (!u) throw new NotFoundException('User not found');
    if (u.roles.includes('admin') || u.roles.includes('support'))
      throw new ForbiddenException('Staff accounts cannot be banned here');
    await this.db.db.transaction(async (tx) => {
      await tx.update(users).set({ bannedAt: new Date() }).where(eq(users.id, userId));
      await tx.delete(sessions).where(eq(sessions.userId, userId));
      // Their listings leave the marketplace immediately; projects stay so counterparties are not stranded.
      await tx
        .update(services)
        .set({ status: 'paused' })
        .where(and(eq(services.sellerId, userId), eq(services.status, 'live')));
      await tx.insert(auditLogs).values({
        actorId: admin.userId,
        action: 'user.banned',
        entityType: 'user',
        entityId: userId,
        after: { reason },
      });
    });
    return { id: userId, banned: true };
  }

  async unban(admin: RequestActor, userId: string, reason: string) {
    const upd = await this.db.db
      .update(users)
      .set({ bannedAt: null })
      .where(eq(users.id, userId))
      .returning({ id: users.id });
    if (!upd.length) throw new NotFoundException('User not found');
    await this.db.db.insert(auditLogs).values({
      actorId: admin.userId,
      action: 'user.unbanned',
      entityType: 'user',
      entityId: userId,
      after: { reason },
    });
    return { id: userId, banned: false };
  }

  /** Pulls a live/paused listing and tells the seller why (they can fix it and resubmit for review). */
  async takedown(admin: RequestActor, serviceId: string, reason: string) {
    const upd = await this.db.db
      .update(services)
      .set({ status: 'rejected', rejectionReason: reason })
      .where(and(eq(services.id, serviceId), sql`${services.status} in ('live', 'paused')`))
      .returning({ id: services.id });
    if (!upd.length)
      throw new UnprocessableEntityException('Only a live or paused service can be taken down');
    await this.db.db.insert(auditLogs).values({
      actorId: admin.userId,
      action: 'service.takedown',
      entityType: 'service',
      entityId: serviceId,
      after: { reason },
    });
    return { id: serviceId, status: 'rejected' as const };
  }
}
