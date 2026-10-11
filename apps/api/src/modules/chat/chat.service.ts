import {
  and,
  asc,
  auditLogs,
  conversationMembers,
  conversations,
  customOffers,
  desc,
  eq,
  files,
  gt,
  inArray,
  lt,
  messageAttachments,
  messages,
  profiles,
  projects,
  sellerProfiles,
  sql,
  users,
  type DbClient,
} from '@glasswork/db';
import {
  detectOffPlatform,
  type ChatMessageView,
  type ConversationView,
  type MessagePageView,
} from '@glasswork/shared';
import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { Redis } from 'ioredis';
import type { RequestActor } from '../../auth/session.service';
import { DB, REDIS } from '../../infra/tokens';
import { AccessService } from '../access/access.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ProjectsService } from '../orders/projects.service';
import { RealtimeService } from '../realtime/realtime.service';

type MessageRow = typeof messages.$inferSelect;
const MESSAGES_PER_MINUTE = 30;

@Injectable()
export class ChatService {
  constructor(
    @Inject(DB) private readonly db: DbClient,
    @Inject(REDIS) private readonly redis: Redis,
    private readonly access: AccessService,
    private readonly realtime: RealtimeService,
    private readonly notifications: NotificationsService,
    private readonly projectsSvc: ProjectsService,
  ) {}

  // ---- conversations ---------------------------------------------------------------------

  /** The project chat is created lazily; its members are exactly the project's participants. */
  async projectConversation(actor: RequestActor, projectId: string): Promise<string> {
    if (!(await this.access.projectRole(actor.userId, projectId)))
      throw new NotFoundException('Project not found');
    return this.db.db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${'conv:' + projectId}))`);
      const [existing] = await tx
        .select({ id: conversations.id })
        .from(conversations)
        .where(eq(conversations.projectId, projectId));
      if (existing) return existing.id;
      const [c] = await tx
        .insert(conversations)
        .values({ kind: 'project', projectId })
        .returning({ id: conversations.id });
      const ids = await this.access.projectParticipantIds(projectId);
      await tx.insert(conversationMembers).values(ids.map((userId) => ({ conversationId: c!.id, userId })));
      return c!.id;
    });
  }

  /** Buyer ↔ seller chat before any order exists (the place custom offers are sent from). */
  async directConversation(actor: RequestActor, otherUserId: string): Promise<string> {
    if (otherUserId === actor.userId) throw new UnprocessableEntityException('You cannot message yourself');
    const [other] = await this.db.db
      .select({ banned: users.bannedAt })
      .from(users)
      .where(eq(users.id, otherUserId));
    // Only published sellers are contactable by strangers; unknown ids look the same.
    const [seller] = await this.db.db
      .select({ done: sellerProfiles.onboardingCompletedAt })
      .from(sellerProfiles)
      .where(eq(sellerProfiles.userId, otherUserId));
    const mySeller = await this.db.db
      .select({ done: sellerProfiles.onboardingCompletedAt })
      .from(sellerProfiles)
      .where(eq(sellerProfiles.userId, actor.userId));
    const iAmPublishedSeller = Boolean(mySeller[0]?.done);
    if (!other || other.banned || !(seller?.done || iAmPublishedSeller))
      throw new NotFoundException('User not found');

    const key = [actor.userId, otherUserId].sort().join(':');
    return this.db.db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${'dm:' + key}))`);
      const [existing] = await tx
        .select({ id: conversations.id })
        .from(conversations)
        .where(eq(conversations.directKey, key));
      if (existing) return existing.id;
      const [c] = await tx
        .insert(conversations)
        .values({ kind: 'direct', directKey: key })
        .returning({ id: conversations.id });
      await tx.insert(conversationMembers).values([
        { conversationId: c!.id, userId: actor.userId },
        { conversationId: c!.id, userId: otherUserId },
      ]);
      return c!.id;
    });
  }

  async list(actor: RequestActor): Promise<ConversationView[]> {
    const mine = await this.db.db
      .select({ c: conversations, lastRead: conversationMembers.lastReadMessageId })
      .from(conversationMembers)
      .innerJoin(conversations, eq(conversations.id, conversationMembers.conversationId))
      .where(eq(conversationMembers.userId, actor.userId));
    const out: ConversationView[] = [];
    for (const { c, lastRead } of mine) {
      const [last] = await this.db.db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, c.id))
        .orderBy(desc(messages.id))
        .limit(1);
      const [unread] = await this.db.db
        .select({ n: sql<number>`count(*)::int` })
        .from(messages)
        .where(
          and(
            eq(messages.conversationId, c.id),
            sql`${messages.senderId} is distinct from ${actor.userId}`,
            lastRead ? gt(messages.id, lastRead) : undefined,
          ),
        );
      const members = await this.access.conversationMemberIds(c.id);
      const counterpartId = members.find((m) => m !== actor.userId) ?? actor.userId;
      let title: string;
      if (c.kind === 'project' && c.projectId) {
        const [p] = await this.db.db
          .select({ title: projects.title })
          .from(projects)
          .where(eq(projects.id, c.projectId));
        title = p?.title ?? 'Project chat';
      } else {
        const [n] = await this.db.db
          .select({ name: profiles.displayName })
          .from(profiles)
          .where(eq(profiles.userId, counterpartId));
        title = n?.name ?? 'Conversation';
      }
      out.push({
        id: c.id,
        kind: c.kind,
        projectId: c.projectId,
        title,
        counterpartId,
        lastMessage: last
          ? {
              body: last.body || (last.kind === 'custom_offer' ? 'Custom offer' : 'Attachment'),
              at: last.createdAt.toISOString(),
              senderId: last.senderId,
            }
          : null,
        unread: unread?.n ?? 0,
      });
    }
    return out.sort((a, b) => (b.lastMessage?.at ?? '').localeCompare(a.lastMessage?.at ?? ''));
  }

  // ---- messages ---------------------------------------------------------------------------

  private async requireMember(actor: RequestActor, conversationId: string) {
    if (!(await this.access.isConversationMember(actor.userId, conversationId)))
      throw new NotFoundException('Conversation not found');
  }

  async page(
    actor: RequestActor,
    conversationId: string,
    cursor: string | undefined,
    limit: number,
  ): Promise<MessagePageView> {
    await this.requireMember(actor, conversationId);
    const rows = await this.db.db
      .select()
      .from(messages)
      .where(and(eq(messages.conversationId, conversationId), cursor ? lt(messages.id, cursor) : undefined))
      .orderBy(desc(messages.id))
      .limit(limit + 1);
    const pageRows = rows.slice(0, limit).reverse();
    const mem = await this.db.db
      .select({
        userId: conversationMembers.userId,
        lastRead: conversationMembers.lastReadMessageId,
        name: profiles.displayName,
      })
      .from(conversationMembers)
      .innerJoin(profiles, eq(profiles.userId, conversationMembers.userId))
      .where(eq(conversationMembers.conversationId, conversationId));
    return {
      conversationId,
      members: mem.map((m) => ({ userId: m.userId, name: m.name, lastReadMessageId: m.lastRead })),
      items: await this.views(pageRows),
      nextCursor: rows.length > limit ? (rows[limit - 1]?.id ?? null) : null,
    };
  }

  async send(
    actor: RequestActor,
    conversationId: string,
    input: { body: string; fileIds: string[] },
  ): Promise<ChatMessageView> {
    await this.requireMember(actor, conversationId);
    await this.rateLimit(actor.userId);
    const fileIds = [...new Set(input.fileIds)];
    if (fileIds.length) {
      const ok = await this.db.db
        .select({ id: files.id })
        .from(files)
        .where(
          and(
            inArray(files.id, fileIds),
            eq(files.ownerId, actor.userId),
            eq(files.purpose, 'message'),
            eq(files.status, 'clean'),
          ),
        );
      // Someone else's (or a pending) file looks the same as a missing one.
      if (ok.length !== fileIds.length) throw new NotFoundException('File not found');
    }
    // Pre-order (direct) chats only: warn about off-platform contact/payment details, log it, never block (brief §8.9).
    const [conv0] = await this.db.db
      .select({ kind: conversations.kind })
      .from(conversations)
      .where(eq(conversations.id, conversationId));
    const flags = conv0?.kind === 'direct' ? detectOffPlatform(input.body) : [];
    const [row] = await this.db.db.transaction(async (tx) => {
      const r = await tx
        .insert(messages)
        .values({
          conversationId,
          senderId: actor.userId,
          body: input.body,
          safetyFlags: flags.length ? { kinds: flags } : {},
        })
        .returning();
      if (flags.length) {
        await tx.insert(auditLogs).values({
          actorId: actor.userId,
          action: 'chat.safety_flag',
          entityType: 'message',
          entityId: r[0]!.id,
          after: { kinds: flags, conversationId },
        });
      }
      if (fileIds.length)
        await tx
          .insert(messageAttachments)
          .values(fileIds.map((fileId) => ({ messageId: r[0]!.id, fileId })));
      return r;
    });
    return this.publish(actor, row!);
  }

  /** Sliding per-user limit so a client (or script) can't flood a conversation (brief §11). */
  private async rateLimit(userId: string) {
    const key = `rl:chat:${userId}`;
    const n = await this.redis.incr(key);
    if (n === 1) await this.redis.expire(key, 60);
    if (n > MESSAGES_PER_MINUTE)
      throw new HttpException('You are sending messages too quickly', HttpStatus.TOO_MANY_REQUESTS);
  }

  private async publish(actor: RequestActor, row: MessageRow): Promise<ChatMessageView> {
    const [view] = await this.views([row]);
    this.realtime.toConversation(row.conversationId, 'chat:message', view!);
    const [conv] = await this.db.db
      .select()
      .from(conversations)
      .where(eq(conversations.id, row.conversationId));
    const others = (await this.access.conversationMemberIds(row.conversationId)).filter(
      (id) => id !== actor.userId,
    );
    const preview = row.body
      ? row.body.slice(0, 140)
      : view!.attachments.length
        ? 'Sent an attachment'
        : 'Sent an offer';
    await this.notifications.notify(others, {
      type: 'chat.message',
      title: `New message from ${view!.sender.name}`,
      body: preview,
      url: conv?.projectId ? `/projects/${conv.projectId}?tab=chat` : `/messages/${row.conversationId}`,
      payload: { conversationId: row.conversationId },
      // One unread notification per conversation, updated in place, instead of one per message.
      collapseKey: row.conversationId,
    });
    return view!;
  }

  async markRead(actor: RequestActor, conversationId: string, messageId: string) {
    await this.requireMember(actor, conversationId);
    const [m] = await this.db.db
      .select({ id: messages.id })
      .from(messages)
      .where(and(eq(messages.id, messageId), eq(messages.conversationId, conversationId)));
    if (!m) throw new NotFoundException('Message not found');
    // Only ever moves forward (UUIDv7 ids sort by time).
    await this.db.db
      .update(conversationMembers)
      .set({ lastReadMessageId: messageId, lastReadAt: new Date() })
      .where(
        and(
          eq(conversationMembers.conversationId, conversationId),
          eq(conversationMembers.userId, actor.userId),
          sql`(${conversationMembers.lastReadMessageId} is null or ${conversationMembers.lastReadMessageId} < ${messageId})`,
        ),
      );
    this.realtime.toConversation(conversationId, 'chat:read', {
      conversationId,
      userId: actor.userId,
      lastReadMessageId: messageId,
    });
    return { ok: true };
  }

  private async views(rows: MessageRow[]): Promise<ChatMessageView[]> {
    if (!rows.length) return [];
    const senderIds = [...new Set(rows.map((r) => r.senderId).filter((x): x is string => Boolean(x)))];
    const names = senderIds.length
      ? await this.db.db
          .select({ id: profiles.userId, name: profiles.displayName })
          .from(profiles)
          .where(inArray(profiles.userId, senderIds))
      : [];
    const atts = await this.db.db
      .select({ messageId: messageAttachments.messageId, f: files })
      .from(messageAttachments)
      .innerJoin(files, eq(files.id, messageAttachments.fileId))
      .where(
        inArray(
          messageAttachments.messageId,
          rows.map((r) => r.id),
        ),
      );
    const offerIds = rows.map((r) => r.offerId).filter((x): x is string => Boolean(x));
    const offers = offerIds.length
      ? await this.db.db.select().from(customOffers).where(inArray(customOffers.id, offerIds))
      : [];
    return rows.map((r) => {
      const o = offers.find((x) => x.id === r.offerId);
      return {
        id: r.id,
        conversationId: r.conversationId,
        sender: {
          id: r.senderId,
          name:
            names.find((n) => n.id === r.senderId)?.name ?? (r.kind === 'system' ? 'System' : 'Deleted user'),
        },
        body: r.body,
        kind: r.kind,
        offer: o
          ? {
              id: o.id,
              title: o.title,
              description: o.description,
              totalAmount: o.totalAmount,
              currency: o.currency,
              status: o.status,
              milestonePlan: o.milestonePlan as { title: string; amount: number; days: number }[],
              projectId: o.projectId,
            }
          : null,
        attachments: atts
          .filter((a) => a.messageId === r.id)
          .map((a) => ({
            id: a.f.id,
            name: a.f.originalName,
            sizeBytes: a.f.sizeBytes,
            mimeType: a.f.mimeType,
          })),
        safetyFlags: (r.safetyFlags as { kinds?: ChatMessageView['safetyFlags'] }).kinds ?? [],
        createdAt: r.createdAt.toISOString(),
      };
    });
  }

  // ---- custom offers -------------------------------------------------------------------------

  async sendOffer(
    actor: RequestActor,
    conversationId: string,
    input: {
      title: string;
      description: string;
      milestonePlan: { title: string; acceptanceCriteria?: string | null; amount: number; days: number }[];
    },
  ) {
    await this.requireMember(actor, conversationId);
    const [conv] = await this.db.db.select().from(conversations).where(eq(conversations.id, conversationId));
    if (!conv || conv.kind !== 'direct')
      throw new UnprocessableEntityException('Custom offers are sent from a direct conversation');
    const [seller] = await this.db.db
      .select({ done: sellerProfiles.onboardingCompletedAt })
      .from(sellerProfiles)
      .where(eq(sellerProfiles.userId, actor.userId));
    if (!seller?.done) throw new UnprocessableEntityException('Publish your seller profile to send offers');
    const buyerId = (await this.access.conversationMemberIds(conversationId)).find(
      (id) => id !== actor.userId,
    );
    if (!buyerId) throw new NotFoundException('Conversation not found');
    const total = input.milestonePlan.reduce((s, m) => s + m.amount, 0);
    const row = await this.db.db.transaction(async (tx) => {
      const [offer] = await tx
        .insert(customOffers)
        .values({
          conversationId,
          sellerId: actor.userId,
          buyerId,
          title: input.title,
          description: input.description,
          milestonePlan: input.milestonePlan,
          totalAmount: total,
        })
        .returning();
      const [msg] = await tx
        .insert(messages)
        .values({
          conversationId,
          senderId: actor.userId,
          kind: 'custom_offer',
          body: input.title,
          offerId: offer!.id,
        })
        .returning();
      await tx.insert(auditLogs).values({
        actorId: actor.userId,
        action: 'offer.sent',
        entityType: 'custom_offer',
        entityId: offer!.id,
        after: { total, buyerId },
      });
      return msg!;
    });
    const view = await this.publish(actor, row);
    await this.notifications.notify([buyerId], {
      type: 'offer.received',
      title: `${view.sender.name} sent you a custom offer`,
      body: input.title,
      url: `/messages/${conversationId}`,
    });
    return view;
  }

  private async offerFor(actor: RequestActor, offerId: string, role: 'buyer' | 'seller') {
    const offer = await this.access.offerForMember(actor.userId, offerId);
    if (!offer || (role === 'buyer' ? offer.buyerId : offer.sellerId) !== actor.userId)
      throw new NotFoundException('Offer not found');
    return offer;
  }

  /** Accepting turns the offer into a project through the same factory as package orders and proposals. */
  async acceptOffer(actor: RequestActor, offerId: string) {
    const offer = await this.offerFor(actor, offerId, 'buyer');
    return this.db.db
      .transaction(async (tx) => {
        const [o] = await tx.select().from(customOffers).where(eq(customOffers.id, offerId)).for('update');
        if (!o || o.status !== 'sent')
          throw new UnprocessableEntityException(`A ${o?.status ?? 'missing'} offer cannot be accepted`);
        const [seller] = await tx
          .select({ done: sellerProfiles.onboardingCompletedAt, banned: users.bannedAt })
          .from(sellerProfiles)
          .innerJoin(users, eq(users.id, sellerProfiles.userId))
          .where(eq(sellerProfiles.userId, o.sellerId));
        if (!seller?.done || seller.banned)
          throw new UnprocessableEntityException('This seller is no longer available');
        const { project, milestones: ms } = await this.projectsSvc.create(
          {
            buyerId: o.buyerId,
            sellerId: o.sellerId,
            title: o.title,
            currency: o.currency,
            plan: o.milestonePlan as {
              title: string;
              acceptanceCriteria?: string | null;
              amount: number;
              days: number;
            }[],
            requirements: { answers: [{ question: 'Custom offer', answer: o.description }] },
            source: 'offer',
          },
          tx,
        );
        await tx
          .update(customOffers)
          .set({ status: 'accepted', projectId: project.id })
          .where(eq(customOffers.id, offerId));
        await tx.insert(auditLogs).values({
          actorId: actor.userId,
          action: 'offer.accepted',
          entityType: 'custom_offer',
          entityId: offerId,
          after: { projectId: project.id, total: o.totalAmount },
        });
        const [sys] = await tx
          .insert(messages)
          .values({
            conversationId: offer.conversationId,
            senderId: null,
            kind: 'system',
            body: `Offer accepted: ${o.title}`,
            offerId,
          })
          .returning();
        return {
          projectId: project.id,
          code: project.code,
          firstMilestoneId: ms[0]!.id,
          systemMessage: sys!,
          sellerId: o.sellerId,
          title: o.title,
        };
      })
      .then(async (r) => {
        const [view] = await this.views([r.systemMessage]);
        this.realtime.toConversation(offer.conversationId, 'chat:message', view!);
        await this.notifications.notify([r.sellerId], {
          type: 'offer.accepted',
          title: `Your offer “${r.title}” was accepted`,
          url: `/projects/${r.projectId}`,
        });
        return { projectId: r.projectId, code: r.code, firstMilestoneId: r.firstMilestoneId };
      });
  }

  async closeOffer(actor: RequestActor, offerId: string, role: 'buyer' | 'seller') {
    const offer = await this.offerFor(actor, offerId, role);
    const status = role === 'buyer' ? 'declined' : 'withdrawn';
    const upd = await this.db.db
      .update(customOffers)
      .set({ status })
      .where(and(eq(customOffers.id, offerId), eq(customOffers.status, 'sent')))
      .returning({ id: customOffers.id });
    if (!upd.length) throw new UnprocessableEntityException(`A ${offer.status} offer cannot be ${status}`);
    const [sys] = await this.db.db
      .insert(messages)
      .values({
        conversationId: offer.conversationId,
        senderId: null,
        kind: 'system',
        body: `Offer ${status}: ${offer.title}`,
        offerId,
      })
      .returning();
    const [view] = await this.views([sys!]);
    this.realtime.toConversation(offer.conversationId, 'chat:message', view!);
    return { status };
  }

  /** Oldest-first helper for tests/tools. */
  async messagesAsc(conversationId: string) {
    return this.db.db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(asc(messages.id));
  }
}
