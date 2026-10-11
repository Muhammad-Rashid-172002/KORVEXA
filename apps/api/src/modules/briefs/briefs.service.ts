import {
  and,
  auditLogs,
  briefs,
  desc,
  eq,
  inArray,
  lt,
  profiles,
  projects,
  proposals,
  sellerProfiles,
  sql,
  users,
  type DbClient,
} from '@glasswork/db';
import type { BriefInput, BriefView, ProposalInput, ProposalView } from '@glasswork/shared';
import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { RequestActor } from '../../auth/session.service';
import { DB } from '../../infra/tokens';
import { ProjectsService } from '../orders/projects.service';

type BriefRow = typeof briefs.$inferSelect;
type ProposalRow = typeof proposals.$inferSelect;

@Injectable()
export class BriefsService {
  constructor(
    @Inject(DB) private readonly db: DbClient,
    private readonly projectsSvc: ProjectsService,
  ) {}

  // ---- briefs -----------------------------------------------------------------

  async create(actor: RequestActor, input: BriefInput): Promise<BriefView> {
    const [row] = await this.db.db
      .insert(briefs)
      .values({
        buyerId: actor.userId,
        title: input.title,
        description: input.description,
        budgetMinAmount: input.budgetMinAmount ?? null,
        budgetMaxAmount: input.budgetMaxAmount ?? null,
        status: 'open',
      })
      .returning();
    if (!row) throw new Error('insert failed');
    await this.db.db.insert(auditLogs).values({
      actorId: actor.userId,
      action: 'brief.created',
      entityType: 'brief',
      entityId: row.id,
    });
    return this.view(actor, row.id);
  }

  /** Open requests for sellers to browse. Only published sellers may browse the board. */
  async board(actor: RequestActor, q: string | undefined, cursor: string | undefined, limit: number) {
    await this.requirePublishedSeller(actor);
    const needle = q ? `%${q.replace(/[%_\\]/g, '\\$&')}%` : null;
    const rows = await this.db.db
      .select()
      .from(briefs)
      .where(
        and(
          eq(briefs.status, 'open'),
          cursor ? lt(briefs.id, cursor) : undefined,
          needle
            ? sql`(${briefs.title} ilike ${needle} or ${briefs.description} ilike ${needle})`
            : undefined,
        ),
      )
      .orderBy(desc(briefs.id))
      .limit(limit + 1);
    const page = rows.slice(0, limit);
    return {
      items: await Promise.all(page.map((b) => this.toView(actor, b, false))),
      nextCursor: rows.length > limit ? (page.at(-1)?.id ?? null) : null,
    };
  }

  async listMine(actor: RequestActor): Promise<BriefView[]> {
    const rows = await this.db.db
      .select()
      .from(briefs)
      .where(eq(briefs.buyerId, actor.userId))
      .orderBy(desc(briefs.id));
    return Promise.all(rows.map((b) => this.toView(actor, b, false)));
  }

  /** Owner, or any published seller while the brief is open. Everyone else: 404. */
  async view(actor: RequestActor, id: string): Promise<BriefView> {
    const [b] = await this.db.db.select().from(briefs).where(eq(briefs.id, id));
    if (!b) throw new NotFoundException('Request not found');
    const isOwner = b.buyerId === actor.userId;
    if (!isOwner) {
      const [mine] = await this.db.db
        .select({ id: proposals.id })
        .from(proposals)
        .where(and(eq(proposals.briefId, id), eq(proposals.sellerId, actor.userId)));
      const seller = await this.isPublishedSeller(actor.userId);
      if (!(seller && (b.status === 'open' || mine))) throw new NotFoundException('Request not found');
    }
    return this.toView(actor, b, true);
  }

  async close(actor: RequestActor, id: string): Promise<BriefView> {
    const [b] = await this.db.db
      .select()
      .from(briefs)
      .where(and(eq(briefs.id, id), eq(briefs.buyerId, actor.userId)));
    if (!b) throw new NotFoundException('Request not found');
    await this.db.db.update(briefs).set({ status: 'closed' }).where(eq(briefs.id, id));
    return this.view(actor, id);
  }

  // ---- proposals ------------------------------------------------------------------

  async propose(actor: RequestActor, briefId: string, input: ProposalInput): Promise<ProposalView> {
    await this.requirePublishedSeller(actor);
    const [b] = await this.db.db.select().from(briefs).where(eq(briefs.id, briefId));
    if (!b || b.status !== 'open') throw new NotFoundException('Request not found');
    if (b.buyerId === actor.userId)
      throw new UnprocessableEntityException('You cannot propose on your own request');
    const total = input.milestonePlan.reduce((s, m) => s + m.amount, 0);
    try {
      const [row] = await this.db.db
        .insert(proposals)
        .values({
          briefId,
          sellerId: actor.userId,
          coverLetter: input.coverLetter,
          milestonePlan: input.milestonePlan,
          totalAmount: total,
          currency: b.currency,
        })
        .returning();
      if (!row) throw new Error('insert failed');
      await this.db.db.insert(auditLogs).values({
        actorId: actor.userId,
        action: 'proposal.sent',
        entityType: 'proposal',
        entityId: row.id,
        after: { briefId, total },
      });
      return (await this.proposalViews([row]))[0]!;
    } catch (err) {
      if ((err as { cause?: { code?: string } }).cause?.code === '23505') {
        throw new ConflictException('You already have an active proposal on this request');
      }
      throw err;
    }
  }

  async withdraw(actor: RequestActor, proposalId: string): Promise<ProposalView> {
    const [p] = await this.db.db
      .select()
      .from(proposals)
      .where(and(eq(proposals.id, proposalId), eq(proposals.sellerId, actor.userId)));
    if (!p) throw new NotFoundException('Proposal not found');
    if (p.status !== 'sent')
      throw new UnprocessableEntityException(`A ${p.status} proposal cannot be withdrawn`);
    const [row] = await this.db.db
      .update(proposals)
      .set({ status: 'withdrawn' })
      .where(eq(proposals.id, p.id))
      .returning();
    return (await this.proposalViews([row!]))[0]!;
  }

  async listMyProposals(actor: RequestActor): Promise<ProposalView[]> {
    const rows = await this.db.db
      .select()
      .from(proposals)
      .where(eq(proposals.sellerId, actor.userId))
      .orderBy(desc(proposals.id));
    return this.proposalViews(rows);
  }

  async decline(actor: RequestActor, proposalId: string): Promise<ProposalView> {
    const { proposal } = await this.ownedProposal(actor, proposalId);
    if (proposal.status !== 'sent')
      throw new UnprocessableEntityException(`A ${proposal.status} proposal cannot be declined`);
    const [row] = await this.db.db
      .update(proposals)
      .set({ status: 'declined' })
      .where(eq(proposals.id, proposalId))
      .returning();
    return (await this.proposalViews([row!]))[0]!;
  }

  /**
   * Buyer accepts a proposal: the plan becomes the project's milestones (amounts as proposed), the brief closes
   * and every other open proposal is declined, all in one transaction. Funding then follows the normal flow.
   */
  async accept(actor: RequestActor, proposalId: string) {
    const { proposal, brief } = await this.ownedProposal(actor, proposalId);
    return this.db.db.transaction(async (tx) => {
      const [p] = await tx.select().from(proposals).where(eq(proposals.id, proposalId)).for('update');
      if (!p || p.status !== 'sent')
        throw new UnprocessableEntityException(`A ${p?.status ?? 'missing'} proposal cannot be accepted`);
      if (!(await this.isPublishedSeller(p.sellerId)))
        throw new UnprocessableEntityException('This seller is no longer available');
      const plan = p.milestonePlan as {
        title: string;
        acceptanceCriteria?: string | null;
        amount: number;
        days: number;
      }[];
      const { project, milestones: ms } = await this.projectsSvc.create(
        {
          buyerId: actor.userId,
          sellerId: p.sellerId,
          proposalId: p.id,
          title: brief.title,
          currency: p.currency,
          plan,
          requirements: {
            answers: [{ question: 'Request', answer: brief.description }],
            notes: p.coverLetter,
          },
          source: 'proposal',
        },
        tx,
      );
      await tx.update(proposals).set({ status: 'accepted' }).where(eq(proposals.id, p.id));
      await tx
        .update(proposals)
        .set({ status: 'declined' })
        .where(and(eq(proposals.briefId, brief.id), eq(proposals.status, 'sent')));
      await tx.update(briefs).set({ status: 'closed' }).where(eq(briefs.id, brief.id));
      await tx.insert(auditLogs).values({
        actorId: actor.userId,
        action: 'proposal.accepted',
        entityType: 'proposal',
        entityId: p.id,
        after: { projectId: project.id, total: p.totalAmount },
      });
      return {
        projectId: project.id,
        code: project.code,
        firstMilestoneId: ms[0]!.id,
        proposalId: proposal.id,
      };
    });
  }

  // ---- internals ----------------------------------------------------------------

  /** Brief owner's lookup of a proposal on one of their briefs; anyone else gets 404. */
  private async ownedProposal(actor: RequestActor, proposalId: string) {
    const [row] = await this.db.db
      .select({ proposal: proposals, brief: briefs })
      .from(proposals)
      .innerJoin(briefs, eq(briefs.id, proposals.briefId))
      .where(and(eq(proposals.id, proposalId), eq(briefs.buyerId, actor.userId)));
    if (!row) throw new NotFoundException('Proposal not found');
    return row;
  }

  private async isPublishedSeller(userId: string) {
    const [r] = await this.db.db
      .select({ done: sellerProfiles.onboardingCompletedAt, banned: users.bannedAt })
      .from(sellerProfiles)
      .innerJoin(users, eq(users.id, sellerProfiles.userId))
      .where(eq(sellerProfiles.userId, userId));
    return Boolean(r?.done && !r.banned);
  }

  private async requirePublishedSeller(actor: RequestActor) {
    if (!(await this.isPublishedSeller(actor.userId))) {
      throw new UnprocessableEntityException('Publish your seller profile first');
    }
  }

  private async toView(actor: RequestActor, b: BriefRow, detailed: boolean): Promise<BriefView> {
    const isOwner = b.buyerId === actor.userId;
    const [buyer] = await this.db.db
      .select({ name: profiles.displayName })
      .from(profiles)
      .where(eq(profiles.userId, b.buyerId));
    const [count] = await this.db.db
      .select({ n: sql<number>`count(*)::int` })
      .from(proposals)
      .where(and(eq(proposals.briefId, b.id), inArray(proposals.status, ['sent', 'accepted'])));
    let list: ProposalView[] | null = null;
    let mine: ProposalView | null = null;
    if (detailed) {
      if (isOwner) {
        const rows = await this.db.db
          .select()
          .from(proposals)
          .where(eq(proposals.briefId, b.id))
          .orderBy(desc(proposals.id));
        list = await this.proposalViews(rows);
      } else {
        const [row] = await this.db.db
          .select()
          .from(proposals)
          .where(and(eq(proposals.briefId, b.id), eq(proposals.sellerId, actor.userId)))
          .orderBy(desc(proposals.id))
          .limit(1);
        mine = row ? (await this.proposalViews([row]))[0]! : null;
      }
    }
    return {
      id: b.id,
      title: b.title,
      description: b.description,
      budgetMinAmount: b.budgetMinAmount,
      budgetMaxAmount: b.budgetMaxAmount,
      currency: b.currency,
      status: b.status,
      buyer: { id: b.buyerId, name: buyer?.name ?? 'Unknown' },
      proposalCount: count?.n ?? 0,
      isOwner,
      proposals: list,
      myProposal: mine,
      createdAt: b.createdAt.toISOString(),
    };
  }

  private async proposalViews(rows: ProposalRow[]): Promise<ProposalView[]> {
    if (!rows.length) return [];
    const sellers = await this.db.db
      .select({ id: profiles.userId, name: profiles.displayName, slug: profiles.slug })
      .from(profiles)
      .where(inArray(profiles.userId, [...new Set(rows.map((r) => r.sellerId))]));
    const bs = await this.db.db
      .select({ id: briefs.id, title: briefs.title })
      .from(briefs)
      .where(inArray(briefs.id, [...new Set(rows.map((r) => r.briefId))]));
    const accepted = await this.db.db
      .select({ proposalId: projects.proposalId, id: projects.id })
      .from(projects)
      .where(
        inArray(
          projects.proposalId,
          rows.map((r) => r.id),
        ),
      );
    return rows.map((r) => {
      const s = sellers.find((x) => x.id === r.sellerId);
      return {
        id: r.id,
        briefId: r.briefId,
        briefTitle: bs.find((x) => x.id === r.briefId)?.title ?? '',
        seller: { id: r.sellerId, name: s?.name ?? 'Unknown', slug: s?.slug ?? null },
        coverLetter: r.coverLetter,
        milestonePlan: r.milestonePlan as ProposalView['milestonePlan'],
        totalAmount: r.totalAmount,
        currency: r.currency,
        status: r.status,
        projectId: accepted.find((a) => a.proposalId === r.id)?.id ?? null,
        createdAt: r.createdAt.toISOString(),
      };
    });
  }
}
