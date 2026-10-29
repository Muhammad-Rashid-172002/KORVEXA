import {
  and,
  asc,
  auditLogs,
  eq,
  files,
  inArray,
  portfolioItems,
  profiles,
  sellerProfiles,
  sellerSkills,
  skills,
  users,
  type DbClient,
} from '@glasswork/db';
import { onboardingSchema, type OnboardingState, type UpdateOnboardingInput } from '@glasswork/shared';
import type {
  OnboardingStatus,
  PortfolioItemInput,
  PortfolioItemView,
  ProfileView,
  SellerView,
  SetModeInput,
  UpdateProfileInput,
  UpdateSellerInput,
} from '@glasswork/shared';
import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { RequestActor } from '../../auth/session.service';
import { DB } from '../../infra/tokens';
import { StorageService } from '../files/storage.service';
import { SellerStatsService } from '../trust/stats.service';

const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

@Injectable()
export class ProfilesService {
  constructor(
    @Inject(DB) private readonly db: DbClient,
    private readonly storage: StorageService,
    private readonly stats: SellerStatsService,
  ) {}

  // ---- mode & seller opt-in -------------------------------------------------

  async setMode(actor: RequestActor, input: SetModeInput) {
    const [u] = await this.db.db.select({ roles: users.roles }).from(users).where(eq(users.id, actor.userId));
    if (!u) throw new NotFoundException();
    if (input.mode === 'seller' && !u.roles.includes('seller')) {
      throw new UnprocessableEntityException('Become a seller first');
    }
    await this.db.db.update(users).set({ activeMode: input.mode }).where(eq(users.id, actor.userId));
    return { activeMode: input.mode };
  }

  async becomeSeller(actor: RequestActor) {
    await this.db.db.transaction(async (tx) => {
      const [u] = await tx.select({ roles: users.roles }).from(users).where(eq(users.id, actor.userId));
      if (!u) throw new NotFoundException();
      if (!u.roles.includes('seller')) {
        await tx
          .update(users)
          .set({ roles: [...u.roles, 'seller'], activeMode: 'seller' })
          .where(eq(users.id, actor.userId));
        await tx.insert(auditLogs).values({
          actorId: actor.userId,
          action: 'user.became_seller',
          entityType: 'user',
          entityId: actor.userId,
        });
      }
      await tx.insert(sellerProfiles).values({ userId: actor.userId }).onConflictDoNothing();
    });
    return { activeMode: 'seller' as const };
  }

  // ---- profile ---------------------------------------------------------------

  async getOwn(actor: RequestActor): Promise<ProfileView> {
    const view = await this.buildView(actor.userId, { includeUnpublishedSeller: true });
    if (!view) throw new NotFoundException();
    return view;
  }

  async getOnboarding(actor: RequestActor): Promise<OnboardingState> {
    const [row] = await this.db.db
      .select({ onboarding: profiles.onboarding })
      .from(profiles)
      .where(eq(profiles.userId, actor.userId));
    return onboardingSchema.parse(row?.onboarding ?? {});
  }

  async updateOnboarding(actor: RequestActor, input: UpdateOnboardingInput): Promise<OnboardingState> {
    const cur = await this.getOnboarding(actor);
    const next = onboardingSchema.parse({
      welcomed: input.welcomed ?? cur.welcomed,
      tours: { ...cur.tours, ...input.tours },
      checklistHidden: input.checklistHidden ?? cur.checklistHidden,
    });
    await this.db.db.update(profiles).set({ onboarding: next }).where(eq(profiles.userId, actor.userId));
    return next;
  }

  async getPublic(slug: string): Promise<ProfileView> {
    const [row] = await this.db.db
      .select({ userId: profiles.userId })
      .from(profiles)
      .innerJoin(users, eq(users.id, profiles.userId))
      .where(eq(profiles.slug, slug.toLowerCase()));
    // Banned users and unpublished handles look identical to unknown ones.
    const view = row ? await this.buildView(row.userId, { includeUnpublishedSeller: false }) : null;
    if (!view) throw new NotFoundException('Profile not found');
    return view;
  }

  async updateOwn(actor: RequestActor, input: UpdateProfileInput): Promise<ProfileView> {
    const patch: Partial<typeof profiles.$inferInsert> = { ...input };
    if (input.slug) {
      const [taken] = await this.db.db
        .select({ userId: profiles.userId })
        .from(profiles)
        .where(eq(profiles.slug, input.slug));
      if (taken && taken.userId !== actor.userId) throw new ConflictException('That handle is taken');
    }
    if (Object.keys(patch).length > 0) {
      await this.db.db.update(profiles).set(patch).where(eq(profiles.userId, actor.userId));
      if (input.displayName) {
        await this.db.db.update(users).set({ name: input.displayName }).where(eq(users.id, actor.userId));
      }
    }
    return this.getOwn(actor);
  }

  suggestSlug(name: string) {
    return slugify(name);
  }

  async setAvatar(actor: RequestActor, fileId: string | null): Promise<ProfileView> {
    if (fileId) await this.requireOwnFile(actor, fileId, 'avatar');
    await this.db.db.update(profiles).set({ avatarFileId: fileId }).where(eq(profiles.userId, actor.userId));
    return this.getOwn(actor);
  }

  // ---- seller ----------------------------------------------------------------

  async updateSeller(actor: RequestActor, input: UpdateSellerInput): Promise<ProfileView> {
    await this.requireSeller(actor);
    if (Object.keys(input).length > 0) {
      await this.db.db.update(sellerProfiles).set(input).where(eq(sellerProfiles.userId, actor.userId));
    }
    return this.getOwn(actor);
  }

  async setSkills(actor: RequestActor, names: string[]): Promise<ProfileView> {
    await this.requireSeller(actor);
    const wanted = new Map<string, string>();
    for (const n of names) {
      const slug = slugify(n);
      if (slug) wanted.set(slug, n.trim());
    }
    await this.db.db.transaction(async (tx) => {
      for (const [slug, name] of wanted) {
        await tx.insert(skills).values({ slug, name }).onConflictDoNothing();
      }
      const rows = wanted.size
        ? await tx
            .select({ id: skills.id })
            .from(skills)
            .where(inArray(skills.slug, [...wanted.keys()]))
        : [];
      await tx.delete(sellerSkills).where(eq(sellerSkills.sellerId, actor.userId));
      if (rows.length) {
        await tx.insert(sellerSkills).values(rows.map((r) => ({ sellerId: actor.userId, skillId: r.id })));
      }
    });
    return this.getOwn(actor);
  }

  async searchSkills(q: string | undefined) {
    const rows = await this.db.db
      .select({ slug: skills.slug, name: skills.name })
      .from(skills)
      .orderBy(asc(skills.name))
      .limit(200);
    const needle = q?.toLowerCase();
    return needle
      ? rows.filter((r) => r.name.toLowerCase().includes(needle)).slice(0, 20)
      : rows.slice(0, 20);
  }

  async addPortfolio(actor: RequestActor, input: PortfolioItemInput): Promise<ProfileView> {
    await this.requireSeller(actor);
    if (input.imageFileId) await this.requireOwnFile(actor, input.imageFileId, 'portfolio');
    await this.db.db.insert(portfolioItems).values({
      sellerId: actor.userId,
      title: input.title,
      description: input.description ?? null,
      url: input.url ?? null,
      imageFileId: input.imageFileId ?? null,
      sortOrder: input.sortOrder ?? 0,
    });
    return this.getOwn(actor);
  }

  async updatePortfolio(
    actor: RequestActor,
    itemId: string,
    input: PortfolioItemInput,
  ): Promise<ProfileView> {
    await this.requireSeller(actor);
    if (input.imageFileId) await this.requireOwnFile(actor, input.imageFileId, 'portfolio');
    const updated = await this.db.db
      .update(portfolioItems)
      .set({
        title: input.title,
        description: input.description ?? null,
        url: input.url ?? null,
        imageFileId: input.imageFileId ?? null,
        ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
      })
      .where(and(eq(portfolioItems.id, itemId), eq(portfolioItems.sellerId, actor.userId)))
      .returning({ id: portfolioItems.id });
    if (updated.length === 0) throw new NotFoundException('Portfolio item not found');
    return this.getOwn(actor);
  }

  async deletePortfolio(actor: RequestActor, itemId: string): Promise<ProfileView> {
    const deleted = await this.db.db
      .delete(portfolioItems)
      .where(and(eq(portfolioItems.id, itemId), eq(portfolioItems.sellerId, actor.userId)))
      .returning({ id: portfolioItems.id });
    if (deleted.length === 0) throw new NotFoundException('Portfolio item not found');
    return this.getOwn(actor);
  }

  async onboarding(actor: RequestActor): Promise<OnboardingStatus> {
    await this.requireSeller(actor);
    const view = await this.buildView(actor.userId, { includeUnpublishedSeller: true });
    const s = view?.seller;
    if (!view || !s) throw new NotFoundException();
    const steps = {
      profile: Boolean(view.headline && view.bio && view.country),
      skills: s.skills.length > 0,
      portfolio: s.portfolio.length > 0,
      rates: s.hourlyRateAmount !== null,
      payout: s.payoutPreference !== null, // placeholder step until the payout rail is decided (Q1/Q6)
      identity: false, // placeholder: real identity verification arrives in Phase 5
    };
    const required = ['profile', 'skills', 'rates'] as const;
    return { steps, required: [...required], complete: required.every((k) => steps[k]) };
  }

  async completeOnboarding(actor: RequestActor): Promise<OnboardingStatus> {
    const status = await this.onboarding(actor);
    if (!status.complete) throw new UnprocessableEntityException('Finish the required steps first');
    const [p] = await this.db.db
      .select({ slug: profiles.slug, name: profiles.displayName })
      .from(profiles)
      .where(eq(profiles.userId, actor.userId));
    if (p && !p.slug) {
      const base = slugify(p.name) || 'seller';
      let slug = base.length >= 3 ? base : `${base}-seller`;
      const [clash] = await this.db.db
        .select({ u: profiles.userId })
        .from(profiles)
        .where(eq(profiles.slug, slug));
      if (clash) slug = `${slug.slice(0, 31)}-${actor.userId.slice(-6)}`;
      await this.db.db.update(profiles).set({ slug }).where(eq(profiles.userId, actor.userId));
    }
    await this.db.db
      .update(sellerProfiles)
      .set({ onboardingCompletedAt: new Date() })
      .where(eq(sellerProfiles.userId, actor.userId));
    await this.db.db.insert(auditLogs).values({
      actorId: actor.userId,
      action: 'seller.onboarding_completed',
      entityType: 'user',
      entityId: actor.userId,
    });
    return this.onboarding(actor);
  }

  // ---- internals ---------------------------------------------------------------

  private async requireSeller(actor: RequestActor) {
    const [row] = await this.db.db
      .select({ userId: sellerProfiles.userId })
      .from(sellerProfiles)
      .where(eq(sellerProfiles.userId, actor.userId));
    if (!row) throw new UnprocessableEntityException('Become a seller first');
  }

  private async requireOwnFile(actor: RequestActor, fileId: string, purpose: 'avatar' | 'portfolio') {
    const [f] = await this.db.db
      .select({ status: files.status, purpose: files.purpose })
      .from(files)
      .where(and(eq(files.id, fileId), eq(files.ownerId, actor.userId)));
    // Another user's file looks exactly like a missing one (D-011).
    if (!f) throw new NotFoundException('File not found');
    if (f.purpose !== purpose || f.status !== 'clean') {
      throw new UnprocessableEntityException(`File must be a completed ${purpose} upload`);
    }
  }

  /** Published-file URL: files linked from a public profile are served by their owner's choice (D-050). */
  private async fileUrl(fileId: string | null): Promise<string | null> {
    if (!fileId) return null;
    const [f] = await this.db.db
      .select({ key: files.storageKey, name: files.originalName, status: files.status })
      .from(files)
      .where(eq(files.id, fileId));
    return f && f.status === 'clean' ? this.storage.presignGet(f.key, f.name) : null;
  }

  private async buildView(
    userId: string,
    opts: { includeUnpublishedSeller: boolean },
  ): Promise<ProfileView | null> {
    const [p] = await this.db.db
      .select({ profile: profiles, banned: users.bannedAt })
      .from(profiles)
      .innerJoin(users, eq(users.id, profiles.userId))
      .where(eq(profiles.userId, userId));
    if (!p || (p.banned && !opts.includeUnpublishedSeller)) return null;

    const [sp] = await this.db.db.select().from(sellerProfiles).where(eq(sellerProfiles.userId, userId));
    let seller: SellerView | null = null;
    if (sp && (opts.includeUnpublishedSeller || sp.onboardingCompletedAt)) {
      const skillRows = await this.db.db
        .select({ slug: skills.slug, name: skills.name })
        .from(sellerSkills)
        .innerJoin(skills, eq(skills.id, sellerSkills.skillId))
        .where(eq(sellerSkills.sellerId, userId))
        .orderBy(asc(skills.name));
      const items = await this.db.db
        .select()
        .from(portfolioItems)
        .where(eq(portfolioItems.sellerId, userId))
        .orderBy(asc(portfolioItems.sortOrder), asc(portfolioItems.id));
      const portfolio: PortfolioItemView[] = await Promise.all(
        items.map(async (i) => ({
          id: i.id,
          title: i.title,
          description: i.description,
          url: i.url,
          imageFileId: i.imageFileId,
          imageUrl: await this.fileUrl(i.imageFileId),
          sortOrder: i.sortOrder,
        })),
      );
      seller = {
        availability: sp.availability,
        hourlyRateAmount: sp.hourlyRateAmount,
        rateCurrency: sp.rateCurrency,
        yearsExperience: sp.yearsExperience,
        payoutPreference: opts.includeUnpublishedSeller ? sp.payoutPreference : null,
        onboardingCompleted: sp.onboardingCompletedAt !== null,
        skills: skillRows,
        portfolio,
        trust: await this.stats.one(userId),
      };
    }
    const pr = p.profile;
    return {
      userId: pr.userId,
      displayName: pr.displayName,
      slug: pr.slug,
      headline: pr.headline,
      bio: pr.bio,
      country: pr.country,
      timezone: pr.timezone,
      languages: pr.languages,
      avatarUrl: await this.fileUrl(pr.avatarFileId),
      seller,
    };
  }
}
