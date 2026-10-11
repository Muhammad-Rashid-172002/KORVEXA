import {
  accounts,
  and,
  auditLogs,
  desc,
  eq,
  files,
  profiles,
  sellerProfiles,
  verifications,
  type DbClient,
} from '@glasswork/db';
import {
  VERIFICATION_KINDS,
  VERIFICATION_LABELS,
  type VerificationKind,
  type VerificationView,
} from '@glasswork/shared';
import { Inject, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import type { RequestActor } from '../../auth/session.service';
import { DB } from '../../infra/tokens';
import { StorageService } from '../files/storage.service';
import { NotificationsService } from '../notifications/notifications.service';

/** Where a link for a store badge must point (a cheap, honest first check; an admin still reviews it). */
const URL_HOSTS: Partial<Record<VerificationKind, RegExp>> = {
  play_store: /^https:\/\/play\.google\.com\//i,
  app_store: /^https:\/\/(apps|itunes)\.apple\.com\//i,
};

interface RequestInput {
  kind: VerificationKind;
  url?: string;
  handle?: string;
  note?: string;
  evidenceFileId?: string;
}

@Injectable()
export class VerificationsService {
  constructor(
    @Inject(DB) private readonly db: DbClient,
    private readonly storage: StorageService,
    private readonly notifications: NotificationsService,
  ) {}

  private async requireSeller(actor: RequestActor) {
    const [sp] = await this.db.db
      .select({ id: sellerProfiles.userId })
      .from(sellerProfiles)
      .where(eq(sellerProfiles.userId, actor.userId));
    if (!sp) throw new UnprocessableEntityException('Become a seller first');
  }

  async mine(actor: RequestActor): Promise<VerificationView[]> {
    await this.requireSeller(actor);
    const rows = await this.db.db.select().from(verifications).where(eq(verifications.userId, actor.userId));
    const [gh] = await this.db.db
      .select({ id: accounts.id })
      .from(accounts)
      .where(and(eq(accounts.userId, actor.userId), eq(accounts.providerId, 'github')));
    return VERIFICATION_KINDS.map((kind) => {
      const row = rows.find((r) => r.kind === kind);
      const automatic = kind === 'github' && Boolean(gh);
      return {
        id: row?.id ?? kind,
        kind,
        label: VERIFICATION_LABELS[kind],
        status: automatic ? 'verified' : (row?.status ?? ('none' as never)),
        automatic,
        reviewNote: row?.reviewNote ?? null,
        createdAt: (row?.createdAt ?? new Date(0)).toISOString(),
      };
    });
  }

  async request(actor: RequestActor, input: RequestInput) {
    await this.requireSeller(actor);
    if (input.kind === 'github') {
      const [gh] = await this.db.db
        .select({ id: accounts.id })
        .from(accounts)
        .where(and(eq(accounts.userId, actor.userId), eq(accounts.providerId, 'github')));
      if (gh)
        throw new UnprocessableEntityException('Your linked GitHub account already counts; no review needed');
    }
    const host = URL_HOSTS[input.kind];
    if (host && !(input.url && host.test(input.url)))
      throw new UnprocessableEntityException('Link must be your store developer/listing page');
    if (['github', 'portfolio'].includes(input.kind) && !input.url && !input.handle) {
      throw new UnprocessableEntityException('Provide a link or handle we can check');
    }
    if (input.kind === 'identity') {
      if (!input.evidenceFileId) throw new UnprocessableEntityException('Upload an identity document');
      const [f] = await this.db.db
        .select()
        .from(files)
        .where(and(eq(files.id, input.evidenceFileId), eq(files.ownerId, actor.userId)));
      if (!f) throw new NotFoundException('File not found');
      if (f.purpose !== 'evidence' || f.status !== 'clean')
        throw new UnprocessableEntityException('The document must be a completed, scanned evidence upload');
    }
    const [existing] = await this.db.db
      .select()
      .from(verifications)
      .where(and(eq(verifications.userId, actor.userId), eq(verifications.kind, input.kind)));
    if (existing?.status === 'verified') throw new UnprocessableEntityException('Already verified');
    if (existing?.status === 'pending')
      throw new UnprocessableEntityException('A request is already waiting for review');
    const evidence = { url: input.url ?? null, handle: input.handle ?? null, note: input.note ?? null };
    await this.db.db
      .insert(verifications)
      .values({
        userId: actor.userId,
        kind: input.kind,
        evidence,
        evidenceFileId: input.evidenceFileId ?? null,
      })
      .onConflictDoUpdate({
        target: [verifications.userId, verifications.kind],
        set: {
          status: 'pending',
          evidence,
          evidenceFileId: input.evidenceFileId ?? null,
          reviewedBy: null,
          reviewNote: null,
          reviewedAt: null,
        },
      });
    await this.db.db.insert(auditLogs).values({
      actorId: actor.userId,
      action: 'verification.requested',
      entityType: 'verification',
      entityId: actor.userId,
      after: { kind: input.kind },
    });
    return this.mine(actor);
  }

  // ---- admin ----------------------------------------------------------------------------

  async queue(status: 'pending' | 'verified' | 'rejected') {
    const rows = await this.db.db
      .select({ v: verifications, name: profiles.displayName, slug: profiles.slug })
      .from(verifications)
      .innerJoin(profiles, eq(profiles.userId, verifications.userId))
      .where(eq(verifications.status, status))
      .orderBy(desc(verifications.id))
      .limit(100);
    return rows.map(({ v, name, slug }) => ({
      id: v.id,
      sellerId: v.userId,
      sellerName: name,
      sellerSlug: slug,
      kind: v.kind,
      label: VERIFICATION_LABELS[v.kind],
      status: v.status,
      evidence: v.evidence as { url: string | null; handle: string | null; note: string | null },
      hasFile: Boolean(v.evidenceFileId),
      createdAt: v.createdAt.toISOString(),
    }));
  }

  async evidenceUrl(id: string) {
    const [v] = await this.db.db.select().from(verifications).where(eq(verifications.id, id));
    if (!v?.evidenceFileId) throw new NotFoundException('No evidence file');
    const [f] = await this.db.db.select().from(files).where(eq(files.id, v.evidenceFileId));
    if (!f) throw new NotFoundException('No evidence file');
    return { url: await this.storage.presignGet(f.storageKey, f.originalName), expiresInSeconds: 300 };
  }

  async decide(admin: RequestActor, id: string, decision: 'verified' | 'rejected', note?: string) {
    const [v] = await this.db.db.select().from(verifications).where(eq(verifications.id, id));
    if (!v) throw new NotFoundException('Verification not found');
    if (v.status !== 'pending') throw new UnprocessableEntityException(`Already ${v.status}`);
    if (decision === 'rejected' && !note) throw new UnprocessableEntityException('Give the seller a reason');
    await this.db.db.transaction(async (tx) => {
      await tx
        .update(verifications)
        .set({ status: decision, reviewedBy: admin.userId, reviewNote: note ?? null, reviewedAt: new Date() })
        .where(eq(verifications.id, id));
      await tx.insert(auditLogs).values({
        actorId: admin.userId,
        action: `verification.${decision}`,
        entityType: 'verification',
        entityId: id,
        before: { status: v.status },
        after: { status: decision, kind: v.kind, note: note ?? null },
      });
    });
    await this.notifications.notify([v.userId], {
      type: 'verification.decided',
      title: `${VERIFICATION_LABELS[v.kind]}: ${decision === 'verified' ? 'approved' : 'not approved'}`,
      body: note ?? null,
      url: '/seller/verification',
    });
    return { id, status: decision };
  }
}
