import {
  accounts,
  auditLogs,
  authTokens,
  and,
  type DbClient,
  disputes,
  eq,
  favorites,
  files,
  inArray,
  messages,
  notificationPreferences,
  notifications,
  orgMembers,
  payouts,
  portfolioItems,
  profiles,
  projects,
  pushSubscriptions,
  reviews,
  savedSearches,
  sellerProfiles,
  services,
  sessions,
  twoFactors,
  users,
  or,
  sql,
} from '@glasswork/db';
import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { RequestActor } from '../../auth/session.service';
import { DB } from '../../infra/tokens';
import { accounts as ledgerAccounts, LedgerService } from '../payments/ledger.service';
import { StorageService } from '../files/storage.service';

/** Projects in these states still involve the other party's money or work, so the account cannot go yet. */
const LIVE_PROJECT = [
  'requirements_submitted',
  'active',
  'paused',
  'cancellation_requested',
  'disputed',
] as const;

/**
 * Data export and account deletion (brief §11). Deletion anonymises the row instead of removing it:
 * ledger entries, invoices, disputes and the other party's project history must stay intact.
 */
@Injectable()
export class AccountService {
  constructor(
    @Inject(DB) private readonly db: DbClient,
    private readonly ledger: LedgerService,
    private readonly storage: StorageService,
  ) {}

  /** Everything we hold about the caller, scoped by their id. Secrets (password hash, tokens, 2FA) are never included. */
  async export(actor: RequestActor) {
    const uid = actor.userId;
    const q = this.db.db;
    const [user] = await q
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        emailVerified: users.emailVerified,
        roles: users.roles,
        activeMode: users.activeMode,
        twoFactorEnabled: users.twoFactorEnabled,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, uid));
    if (!user) throw new NotFoundException();
    const [profile] = await q.select().from(profiles).where(eq(profiles.userId, uid));
    const [seller] = await q.select().from(sellerProfiles).where(eq(sellerProfiles.userId, uid));
    const out = {
      exportedAt: new Date().toISOString(),
      account: user,
      profile: profile ?? null,
      sellerProfile: seller ?? null,
      linkedLogins: await q
        .select({ provider: accounts.providerId, createdAt: accounts.createdAt })
        .from(accounts)
        .where(eq(accounts.userId, uid)),
      sessions: await q
        .select({
          ipAddress: sessions.ipAddress,
          userAgent: sessions.userAgent,
          createdAt: sessions.createdAt,
          expiresAt: sessions.expiresAt,
        })
        .from(sessions)
        .where(eq(sessions.userId, uid)),
      portfolio: await q.select().from(portfolioItems).where(eq(portfolioItems.sellerId, uid)),
      services: await q.select().from(services).where(eq(services.sellerId, uid)),
      organizations: await q.select().from(orgMembers).where(eq(orgMembers.userId, uid)),
      projects: await q
        .select()
        .from(projects)
        .where(or(eq(projects.buyerId, uid), eq(projects.sellerId, uid))),
      messagesSent: await q.select().from(messages).where(eq(messages.senderId, uid)),
      reviewsWritten: await q.select().from(reviews).where(eq(reviews.authorId, uid)),
      favorites: await q.select().from(favorites).where(eq(favorites.userId, uid)),
      savedSearches: await q.select().from(savedSearches).where(eq(savedSearches.userId, uid)),
      notifications: await q.select().from(notifications).where(eq(notifications.userId, uid)),
      notificationPreferences: await q
        .select()
        .from(notificationPreferences)
        .where(eq(notificationPreferences.userId, uid)),
      payouts: await q.select().from(payouts).where(eq(payouts.sellerId, uid)),
      files: await q
        .select({
          id: files.id,
          name: files.originalName,
          mimeType: files.mimeType,
          sizeBytes: files.sizeBytes,
          purpose: files.purpose,
          createdAt: files.createdAt,
        })
        .from(files)
        .where(eq(files.ownerId, uid)),
      activity: await q.select().from(auditLogs).where(eq(auditLogs.actorId, uid)),
    };
    await q
      .insert(auditLogs)
      .values({ actorId: uid, action: 'account.exported', entityType: 'user', entityId: uid });
    return out;
  }

  /** Reasons the account can't be deleted yet. Empty = go ahead. */
  async blockers(actor: RequestActor): Promise<string[]> {
    const uid = actor.userId;
    const q = this.db.db;
    const out: string[] = [];
    const live = await q
      .select({ id: projects.id })
      .from(projects)
      .where(
        and(
          or(eq(projects.buyerId, uid), eq(projects.sellerId, uid)),
          inArray(projects.status, [...LIVE_PROJECT]),
        ),
      )
      .limit(1);
    if (live.length) out.push('You have projects in progress. Finish or cancel them first.');
    const dispute = await q
      .select({ id: disputes.id })
      .from(disputes)
      .innerJoin(projects, eq(projects.id, disputes.projectId))
      .where(
        and(
          or(eq(projects.buyerId, uid), eq(projects.sellerId, uid)),
          inArray(disputes.status, ['open', 'under_review']),
        ),
      )
      .limit(1);
    if (dispute.length) out.push('You have an unresolved dispute.');
    const [seller] = await q
      .select({ id: sellerProfiles.userId })
      .from(sellerProfiles)
      .where(eq(sellerProfiles.userId, uid));
    if (seller) {
      const pending = await q
        .select({ id: payouts.id })
        .from(payouts)
        .where(and(eq(payouts.sellerId, uid), inArray(payouts.status, ['requested', 'processing'])))
        .limit(1);
      if (pending.length) out.push('A payout is still being processed.');
      const balance = await this.ledger.creditBalance(ledgerAccounts.sellerPayable(uid).code);
      if (balance > 0) out.push('You have an unpaid balance. Request a payout first.');
    }
    const owned = await q.execute(sql`
      select 1 from org_members o
      where o.user_id = ${uid} and o.role = 'owner'
        and exists (select 1 from org_members x where x.org_id = o.org_id and x.user_id <> o.user_id)
        and not exists (select 1 from org_members y where y.org_id = o.org_id and y.user_id <> o.user_id and y.role = 'owner')
      limit 1`);
    if (owned.rows.length)
      out.push('You are the only owner of a team that has other members. Transfer ownership first.');
    return out;
  }

  async deleteAccount(actor: RequestActor, confirmEmail: string): Promise<void> {
    if (confirmEmail.trim().toLowerCase() !== actor.email.toLowerCase())
      throw new ConflictException('Type your account email to confirm.');
    const reasons = await this.blockers(actor);
    if (reasons.length) throw new ConflictException({ message: 'Account cannot be deleted yet.', reasons });
    const uid = actor.userId;
    const now = new Date();
    const keys = await this.db.db
      .select({ key: files.storageKey })
      .from(files)
      .where(and(eq(files.ownerId, uid), inArray(files.purpose, ['avatar', 'portfolio'])));

    await this.db.db.transaction(async (tx) => {
      await tx.update(services).set({ status: 'paused' }).where(eq(services.sellerId, uid));
      await tx.delete(portfolioItems).where(eq(portfolioItems.sellerId, uid));
      await tx
        .update(sellerProfiles)
        .set({ payoutPreference: null, onboardingCompletedAt: null })
        .where(eq(sellerProfiles.userId, uid));
      await tx
        .update(profiles)
        .set({
          displayName: 'Deleted user',
          slug: null,
          avatarFileId: null,
          headline: null,
          bio: null,
          country: null,
          timezone: null,
          languages: [],
        })
        .where(eq(profiles.userId, uid));
      await tx
        .delete(files)
        .where(and(eq(files.ownerId, uid), inArray(files.purpose, ['avatar', 'portfolio'])));
      await tx.delete(favorites).where(eq(favorites.userId, uid));
      await tx.delete(savedSearches).where(eq(savedSearches.userId, uid));
      await tx.delete(notifications).where(eq(notifications.userId, uid));
      await tx.delete(notificationPreferences).where(eq(notificationPreferences.userId, uid));
      await tx.delete(pushSubscriptions).where(eq(pushSubscriptions.userId, uid));
      await tx.delete(orgMembers).where(eq(orgMembers.userId, uid));
      await tx.delete(authTokens).where(eq(authTokens.identifier, actor.email.toLowerCase()));
      await tx.delete(twoFactors).where(eq(twoFactors.userId, uid));
      await tx.delete(accounts).where(eq(accounts.userId, uid));
      await tx.delete(sessions).where(eq(sessions.userId, uid));
      await tx
        .update(users)
        .set({
          email: `deleted-${uid}@deleted.invalid`,
          name: 'Deleted user',
          image: null,
          emailVerified: false,
          twoFactorEnabled: false,
          roles: ['buyer'],
          adminScopes: [],
          deletedAt: now,
        })
        .where(eq(users.id, uid));
      await tx
        .insert(auditLogs)
        .values({ actorId: uid, action: 'account.deleted', entityType: 'user', entityId: uid });
    });
    // Storage cleanup after commit; a failure leaves an orphan object, never a half-deleted account.
    await Promise.allSettled(keys.map((k) => this.storage.delete(k.key)));
  }
}
