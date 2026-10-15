import {
  and,
  asc,
  auditLogs,
  categories,
  desc,
  eq,
  favorites,
  files,
  inArray,
  lt,
  profiles,
  savedSearches,
  sellerProfiles,
  serviceExtras,
  serviceFaqs,
  serviceImages,
  servicePackages,
  services,
  sql,
  users,
  type DbClient,
} from '@glasswork/db';
import type {
  SavedSearchView,
  ServiceCardView,
  ServiceDetailView,
  ServiceInput,
  ServicePageView,
  ServiceSearchQuery,
  ServiceStatus,
} from '@glasswork/shared';
import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { RequestActor } from '../../auth/session.service';
import { DB } from '../../infra/tokens';
import { StorageService } from '../files/storage.service';
import { SellerStatsService } from '../trust/stats.service';
import { SearchService } from './search.service';

const slugBase = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

type Tx = Parameters<Parameters<DbClient['db']['transaction']>[0]>[0];

@Injectable()
export class ServicesService {
  constructor(
    @Inject(DB) private readonly db: DbClient,
    private readonly storage: StorageService,
    private readonly search: SearchService,
    private readonly stats: SellerStatsService,
  ) {}

  // ---- public ---------------------------------------------------------------

  listCategories() {
    return this.db.db
      .select({
        id: categories.id,
        slug: categories.slug,
        name: categories.name,
        parentId: categories.parentId,
      })
      .from(categories)
      .orderBy(sql`${categories.parentId} is not null`, asc(categories.sortOrder), asc(categories.name));
  }

  async searchPublic(q: ServiceSearchQuery): Promise<ServicePageView> {
    const { ids, nextCursor } = await this.search.searchServices(q);
    return { items: await this.cards(ids), nextCursor };
  }

  async getPublic(slug: string): Promise<ServiceDetailView> {
    const [row] = await this.db.db
      .select({ id: services.id })
      .from(services)
      .innerJoin(sellerProfiles, eq(sellerProfiles.userId, services.sellerId))
      .innerJoin(users, eq(users.id, services.sellerId))
      .where(
        and(
          eq(services.slug, slug),
          eq(services.status, 'live'),
          sql`${sellerProfiles.onboardingCompletedAt} is not null`,
          sql`${users.bannedAt} is null`,
        ),
      );
    if (!row) throw new NotFoundException('Service not found');
    return this.detail(row.id);
  }

  // ---- seller ---------------------------------------------------------------

  async create(actor: RequestActor, input: ServiceInput): Promise<ServiceDetailView> {
    await this.requireSeller(actor);
    await this.validateRefs(actor, input);
    const id = await this.db.db.transaction(async (tx) => {
      const [s] = await tx
        .insert(services)
        .values({
          sellerId: actor.userId,
          categoryId: input.categoryId,
          slug: `${slugBase(input.title) || 'service'}-${randomBytes(3).toString('hex')}`,
          title: input.title,
          description: input.description,
          requirementsForm: input.requirementsForm,
        })
        .returning({ id: services.id });
      if (!s) throw new Error('insert failed');
      await this.writeChildren(tx, s.id, input);
      await tx.insert(auditLogs).values({
        actorId: actor.userId,
        action: 'service.created',
        entityType: 'service',
        entityId: s.id,
      });
      return s.id;
    });
    return this.detail(id);
  }

  async update(actor: RequestActor, id: string, input: ServiceInput): Promise<ServiceDetailView> {
    const current = await this.owned(actor, id);
    await this.validateRefs(actor, input);
    // Content edits to a live listing go back through review so approved text can't be swapped afterwards.
    const status: ServiceStatus = current.status === 'live' ? 'pending_review' : current.status;
    await this.db.db.transaction(async (tx) => {
      await tx
        .update(services)
        .set({
          categoryId: input.categoryId,
          title: input.title,
          description: input.description,
          requirementsForm: input.requirementsForm,
          status,
        })
        .where(eq(services.id, id));
      await tx.delete(servicePackages).where(eq(servicePackages.serviceId, id));
      await tx.delete(serviceExtras).where(eq(serviceExtras.serviceId, id));
      await tx.delete(serviceFaqs).where(eq(serviceFaqs.serviceId, id));
      await tx.delete(serviceImages).where(eq(serviceImages.serviceId, id));
      await this.writeChildren(tx, id, input);
      await tx.insert(auditLogs).values({
        actorId: actor.userId,
        action: 'service.updated',
        entityType: 'service',
        entityId: id,
        before: { status: current.status },
        after: { status },
      });
    });
    return this.detail(id);
  }

  async listMine(actor: RequestActor): Promise<ServiceCardView[]> {
    const rows = await this.db.db
      .select({ id: services.id })
      .from(services)
      .where(eq(services.sellerId, actor.userId))
      .orderBy(desc(services.id));
    return this.cards(rows.map((r) => r.id));
  }

  async getMine(actor: RequestActor, id: string) {
    await this.owned(actor, id);
    return this.detail(id);
  }

  async transition(actor: RequestActor, id: string, action: 'submit' | 'pause' | 'resume') {
    const s = await this.owned(actor, id);
    let next: ServiceStatus;
    if (action === 'submit') {
      if (s.status !== 'draft' && s.status !== 'rejected') {
        throw new UnprocessableEntityException(`A ${s.status} service cannot be submitted`);
      }
      const [sp] = await this.db.db
        .select({ done: sellerProfiles.onboardingCompletedAt })
        .from(sellerProfiles)
        .where(eq(sellerProfiles.userId, actor.userId));
      if (!sp?.done) throw new UnprocessableEntityException('Publish your seller profile first');
      next = 'pending_review';
    } else if (action === 'pause') {
      if (s.status !== 'live') throw new UnprocessableEntityException('Only live services can be paused');
      next = 'paused';
    } else {
      if (s.status !== 'paused' || !s.publishedAt) {
        throw new UnprocessableEntityException('Only paused, previously approved services can be resumed');
      }
      next = 'live';
    }
    await this.setStatus(actor.userId, id, s.status, next, { rejectionReason: null });
    return this.detail(id);
  }

  async deleteMine(actor: RequestActor, id: string) {
    const s = await this.owned(actor, id);
    // TODO(Phase 3): also refuse when any order references the service.
    if (s.status === 'live' || s.status === 'pending_review') {
      throw new UnprocessableEntityException('Pause or withdraw the service before deleting it');
    }
    await this.db.db.delete(services).where(eq(services.id, id));
    await this.db.db.insert(auditLogs).values({
      actorId: actor.userId,
      action: 'service.deleted',
      entityType: 'service',
      entityId: id,
    });
    return { ok: true };
  }

  // ---- favorites & saved searches -------------------------------------------

  async addFavorite(actor: RequestActor, serviceId: string) {
    const [s] = await this.db.db
      .select({ id: services.id })
      .from(services)
      .where(and(eq(services.id, serviceId), eq(services.status, 'live')));
    if (!s) throw new NotFoundException('Service not found');
    await this.db.db.insert(favorites).values({ userId: actor.userId, serviceId }).onConflictDoNothing();
    return { favorited: true };
  }

  async removeFavorite(actor: RequestActor, serviceId: string) {
    await this.db.db
      .delete(favorites)
      .where(and(eq(favorites.userId, actor.userId), eq(favorites.serviceId, serviceId)));
    return { favorited: false };
  }

  async favoriteIds(actor: RequestActor): Promise<string[]> {
    const rows = await this.db.db
      .select({ id: favorites.serviceId })
      .from(favorites)
      .where(eq(favorites.userId, actor.userId));
    return rows.map((r) => r.id);
  }

  async listFavorites(actor: RequestActor): Promise<ServiceCardView[]> {
    const rows = await this.db.db
      .select({ id: favorites.serviceId })
      .from(favorites)
      .innerJoin(services, and(eq(services.id, favorites.serviceId), eq(services.status, 'live')))
      .where(eq(favorites.userId, actor.userId))
      .orderBy(desc(favorites.createdAt));
    return this.cards(rows.map((r) => r.id));
  }

  async saveSearch(actor: RequestActor, input: { name: string; query: SavedSearchView['query'] }) {
    const [{ n } = { n: 0 }] = await this.db.db
      .select({ n: sql<number>`count(*)::int` })
      .from(savedSearches)
      .where(eq(savedSearches.userId, actor.userId));
    if (n >= 25) throw new ConflictException('You can keep up to 25 saved searches');
    await this.db.db
      .insert(savedSearches)
      .values({ userId: actor.userId, name: input.name, query: input.query });
    return this.listSavedSearches(actor);
  }

  async listSavedSearches(actor: RequestActor): Promise<SavedSearchView[]> {
    const rows = await this.db.db
      .select()
      .from(savedSearches)
      .where(eq(savedSearches.userId, actor.userId))
      .orderBy(desc(savedSearches.id));
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      query: r.query as SavedSearchView['query'],
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async deleteSavedSearch(actor: RequestActor, id: string) {
    const deleted = await this.db.db
      .delete(savedSearches)
      .where(and(eq(savedSearches.id, id), eq(savedSearches.userId, actor.userId)))
      .returning({ id: savedSearches.id });
    if (!deleted.length) throw new NotFoundException('Saved search not found');
    return this.listSavedSearches(actor);
  }

  // ---- admin moderation -----------------------------------------------------

  async adminList(
    status: ServiceStatus,
    cursor: string | undefined,
    limit: number,
  ): Promise<ServicePageView> {
    const rows = await this.db.db
      .select({ id: services.id })
      .from(services)
      .where(and(eq(services.status, status), cursor ? lt(services.id, cursor) : undefined))
      .orderBy(desc(services.id))
      .limit(limit + 1);
    const page = rows.slice(0, limit);
    return {
      items: await this.cards(page.map((r) => r.id)),
      nextCursor: rows.length > limit ? (page.at(-1)?.id ?? null) : null,
    };
  }

  async adminDetail(id: string) {
    return this.detail(id);
  }

  async moderate(actor: RequestActor, id: string, decision: 'approve' | 'reject', reason?: string) {
    const [s] = await this.db.db.select().from(services).where(eq(services.id, id));
    if (!s) throw new NotFoundException('Service not found');
    if (s.status !== 'pending_review')
      throw new UnprocessableEntityException('Service is not awaiting review');
    if (decision === 'approve') {
      await this.setStatus(actor.userId, id, s.status, 'live', {
        rejectionReason: null,
        publishedAt: s.publishedAt ?? new Date(),
      });
    } else {
      await this.setStatus(actor.userId, id, s.status, 'rejected', { rejectionReason: reason ?? 'Rejected' });
    }
    return this.detail(id);
  }

  async setPlatformFlag(actor: RequestActor, id: string, value: boolean) {
    const updated = await this.db.db
      .update(services)
      .set({ operatedByPlatform: value })
      .where(eq(services.id, id))
      .returning({ id: services.id });
    if (!updated.length) throw new NotFoundException('Service not found');
    await this.db.db.insert(auditLogs).values({
      actorId: actor.userId,
      action: 'service.platform_flag_changed',
      entityType: 'service',
      entityId: id,
      after: { operatedByPlatform: value },
    });
    return this.detail(id);
  }

  // ---- internals ------------------------------------------------------------

  private async requireSeller(actor: RequestActor) {
    const [row] = await this.db.db
      .select({ userId: sellerProfiles.userId })
      .from(sellerProfiles)
      .where(eq(sellerProfiles.userId, actor.userId));
    if (!row) throw new UnprocessableEntityException('Become a seller first');
  }

  /** Owner-scoped lookup: other sellers' services look nonexistent (D-011). */
  private async owned(actor: RequestActor, id: string) {
    const [s] = await this.db.db
      .select()
      .from(services)
      .where(and(eq(services.id, id), eq(services.sellerId, actor.userId)));
    if (!s) throw new NotFoundException('Service not found');
    return s;
  }

  private async validateRefs(actor: RequestActor, input: ServiceInput) {
    const [cat] = await this.db.db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.id, input.categoryId));
    if (!cat) throw new UnprocessableEntityException('Unknown category');
    if (input.imageFileIds.length) {
      const ok = await this.db.db
        .select({ id: files.id })
        .from(files)
        .where(
          and(
            inArray(files.id, input.imageFileIds),
            eq(files.ownerId, actor.userId),
            eq(files.purpose, 'portfolio'),
            eq(files.status, 'clean'),
          ),
        );
      if (ok.length !== new Set(input.imageFileIds).size) throw new NotFoundException('File not found');
    }
  }

  private async writeChildren(tx: Tx, serviceId: string, input: ServiceInput) {
    await tx.insert(servicePackages).values(input.packages.map((p) => ({ ...p, serviceId })));
    if (input.extras.length) {
      await tx.insert(serviceExtras).values(input.extras.map((e, i) => ({ ...e, serviceId, sortOrder: i })));
    }
    if (input.faqs.length) {
      await tx.insert(serviceFaqs).values(input.faqs.map((f, i) => ({ ...f, serviceId, sortOrder: i })));
    }
    if (input.imageFileIds.length) {
      await tx
        .insert(serviceImages)
        .values([...new Set(input.imageFileIds)].map((fileId, i) => ({ serviceId, fileId, sortOrder: i })));
    }
  }

  private async setStatus(
    actorId: string,
    id: string,
    from: ServiceStatus,
    to: ServiceStatus,
    extra: { rejectionReason?: string | null; publishedAt?: Date },
  ) {
    await this.db.db.transaction(async (tx) => {
      await tx
        .update(services)
        .set({ status: to, ...extra })
        .where(eq(services.id, id));
      await tx.insert(auditLogs).values({
        actorId,
        action: `service.${to}`,
        entityType: 'service',
        entityId: id,
        before: { status: from },
        after: { status: to, reason: extra.rejectionReason ?? null },
      });
    });
  }

  private async url(fileId: string | null): Promise<string | null> {
    if (!fileId) return null;
    const [f] = await this.db.db
      .select({ key: files.storageKey, name: files.originalName, status: files.status })
      .from(files)
      .where(eq(files.id, fileId));
    return f && f.status === 'clean' ? this.storage.presignGet(f.key, f.name) : null;
  }

  /** Builds listing cards for ids, preserving the given order. */
  /** Public card views for already-selected service ids (live only, order preserved). */
  cardsFor(ids: string[]): Promise<ServiceCardView[]> {
    return this.cards(ids);
  }

  private async cards(ids: string[]): Promise<ServiceCardView[]> {
    if (!ids.length) return [];
    const rows = await this.db.db
      .select({
        s: services,
        categorySlug: categories.slug,
        categoryName: categories.name,
        displayName: profiles.displayName,
        slug: profiles.slug,
        avatarFileId: profiles.avatarFileId,
      })
      .from(services)
      .innerJoin(categories, eq(categories.id, services.categoryId))
      .innerJoin(profiles, eq(profiles.userId, services.sellerId))
      .where(inArray(services.id, ids));
    const agg = await this.db.db
      .select({
        serviceId: servicePackages.serviceId,
        fromPrice: sql<number>`min(${servicePackages.priceAmount})::bigint`.mapWith(Number),
        currency: sql<string>`min(${servicePackages.currency})`,
        days: sql<number>`min(${servicePackages.deliveryDays})::int`,
      })
      .from(servicePackages)
      .where(inArray(servicePackages.serviceId, ids))
      .groupBy(servicePackages.serviceId);
    const firstImages = await this.db.db
      .select({
        serviceId: serviceImages.serviceId,
        fileId: serviceImages.fileId,
        order: serviceImages.sortOrder,
      })
      .from(serviceImages)
      .where(inArray(serviceImages.serviceId, ids))
      .orderBy(asc(serviceImages.sortOrder));
    const aggBy = new Map(agg.map((a) => [a.serviceId, a]));
    const imgBy = new Map<string, string>();
    for (const i of firstImages) if (!imgBy.has(i.serviceId)) imgBy.set(i.serviceId, i.fileId);
    const rowBy = new Map(rows.map((r) => [r.s.id, r]));
    const trust = await this.stats.get(rows.map((r) => r.s.sellerId));

    const out: ServiceCardView[] = [];
    for (const id of ids) {
      const r = rowBy.get(id);
      if (!r) continue;
      const a = aggBy.get(id);
      out.push({
        id,
        slug: r.s.slug,
        title: r.s.title,
        category: { slug: r.categorySlug, name: r.categoryName },
        seller: {
          id: r.s.sellerId,
          slug: r.slug,
          displayName: r.displayName,
          avatarUrl: await this.url(r.avatarFileId),
        },
        fromPrice: a?.fromPrice ?? 0,
        currency: a?.currency ?? 'USD',
        minDeliveryDays: a?.days ?? 0,
        imageUrl: await this.url(imgBy.get(id) ?? null),
        operatedByPlatform: r.s.operatedByPlatform,
        isDemo: r.s.isSeed,
        status: r.s.status,
        trust: {
          level: trust.get(r.s.sellerId)?.level ?? 'new',
          levelLabel: trust.get(r.s.sellerId)?.levelLabel ?? 'New seller',
          avgRating: trust.get(r.s.sellerId)?.avgRating ?? null,
          reviewCount: trust.get(r.s.sellerId)?.reviewCount ?? 0,
          verified: (trust.get(r.s.sellerId)?.badges.length ?? 0) > 0,
        },
      });
    }
    return out;
  }

  private async detail(id: string): Promise<ServiceDetailView> {
    const [card] = await this.cards([id]);
    const [s] = await this.db.db.select().from(services).where(eq(services.id, id));
    if (!card || !s) throw new NotFoundException('Service not found');
    const [pkgs, extras, faqs, imgs] = await Promise.all([
      this.db.db.select().from(servicePackages).where(eq(servicePackages.serviceId, id)),
      this.db.db
        .select()
        .from(serviceExtras)
        .where(eq(serviceExtras.serviceId, id))
        .orderBy(asc(serviceExtras.sortOrder)),
      this.db.db
        .select()
        .from(serviceFaqs)
        .where(eq(serviceFaqs.serviceId, id))
        .orderBy(asc(serviceFaqs.sortOrder)),
      this.db.db
        .select()
        .from(serviceImages)
        .where(eq(serviceImages.serviceId, id))
        .orderBy(asc(serviceImages.sortOrder)),
    ]);
    const tierOrder = { basic: 0, standard: 1, premium: 2 } as const;
    return {
      ...card,
      description: s.description,
      rejectionReason: s.rejectionReason,
      requirementsForm: s.requirementsForm as ServiceDetailView['requirementsForm'],
      packages: pkgs
        .map((p) => ({
          id: p.id,
          tier: p.tier,
          title: p.title,
          description: p.description,
          priceAmount: p.priceAmount,
          deliveryDays: p.deliveryDays,
          revisions: p.revisions,
        }))
        .sort((a, b) => tierOrder[a.tier] - tierOrder[b.tier]),
      extras: extras.map((e) => ({
        id: e.id,
        title: e.title,
        priceAmount: e.priceAmount,
        extraDays: e.extraDays,
      })),
      faqs: faqs.map((f) => ({ id: f.id, question: f.question, answer: f.answer })),
      images: await Promise.all(imgs.map(async (i) => ({ fileId: i.fileId, url: await this.url(i.fileId) }))),
      publishedAt: s.publishedAt?.toISOString() ?? null,
      updatedAt: s.updatedAt.toISOString(),
    };
  }
}
