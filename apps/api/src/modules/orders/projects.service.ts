import {
  and,
  asc,
  desc,
  eq,
  escrowHolds,
  inArray,
  lt,
  milestones,
  payments,
  profiles,
  projectParticipants,
  projects,
  servicePackages,
  serviceExtras,
  tasks,
  services,
  sellerProfiles,
  users,
  type DbClient,
  type DbTx,
} from '@glasswork/db';
import {
  DEFAULT_MILESTONE_TEMPLATE,
  availableEvents,
  computeHealth,
  milestoneMachine,
  projectProgress,
  quoteFees,
  splitByPercent,
  type CreateOrderInput,
  type MilestoneAction,
  type MilestoneStatus,
  type MilestoneView,
  type ProjectListItem,
  type ProjectView,
} from '@glasswork/shared';
import { Inject, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import type { RequestActor } from '../../auth/session.service';
import { DB } from '../../infra/tokens';
import { FeesService } from '../payments/fees.service';
import { recordChange } from './commerce.util';

export interface NewMilestone {
  title: string;
  acceptanceCriteria?: string | null;
  amount: number;
  days: number;
}

@Injectable()
export class ProjectsService {
  constructor(
    @Inject(DB) private readonly db: DbClient,
    private readonly fees: FeesService,
  ) {}

  // ---- creation ----------------------------------------------------------------

  /** Creates a project from a service package. Prices come from the DB only; nothing amount-like is read from the client. */
  async createFromOrder(actor: RequestActor, input: CreateOrderInput) {
    const [row] = await this.db.db
      .select({ pkg: servicePackages, svc: services })
      .from(servicePackages)
      .innerJoin(services, eq(services.id, servicePackages.serviceId))
      .where(and(eq(servicePackages.id, input.packageId), eq(services.status, 'live')));
    // Same visibility rule as public search: unpublished or banned sellers can't be ordered from.
    if (!row || !(await this.sellerIsPublic(row.svc.sellerId)))
      throw new NotFoundException('Service not found');
    const { pkg, svc } = row;
    if (svc.sellerId === actor.userId)
      throw new UnprocessableEntityException('You cannot order your own service');

    const form = (svc.requirementsForm as { label: string; required: boolean }[]) ?? [];
    const answers = form.map((f, i) => ({ question: f.label, answer: input.answers[i]?.trim() ?? '' }));
    const missing = form.findIndex((f, i) => f.required && !answers[i]!.answer);
    if (missing >= 0) throw new UnprocessableEntityException(`Please answer: ${form[missing]!.label}`);

    let extrasTotal = 0;
    let extraDays = 0;
    const extraTitles: string[] = [];
    if (input.extraIds.length) {
      const wanted = [...new Set(input.extraIds)];
      const rows = await this.db.db
        .select()
        .from(serviceExtras)
        .where(and(inArray(serviceExtras.id, wanted), eq(serviceExtras.serviceId, svc.id)));
      if (rows.length !== wanted.length) throw new UnprocessableEntityException('Unknown extra selected');
      for (const e of rows) {
        extrasTotal += e.priceAmount;
        extraDays += e.extraDays;
        extraTitles.push(e.title);
      }
    }

    const total = pkg.priceAmount + extrasTotal;
    const days = pkg.deliveryDays + extraDays;
    const template = (pkg.milestoneTemplate as { title: string; percent: number }[] | null) ?? [
      ...DEFAULT_MILESTONE_TEMPLATE,
    ];
    const amounts = splitByPercent(
      total,
      template.map((t) => t.percent),
    );
    let cumulative = 0;
    const plan: NewMilestone[] = template.map((t, i) => {
      cumulative += t.percent;
      return { title: t.title, amount: amounts[i]!, days: Math.ceil((days * cumulative) / 100) };
    });

    return this.create({
      buyerId: actor.userId,
      sellerId: svc.sellerId,
      serviceId: svc.id,
      packageId: pkg.id,
      title: `${svc.title} (${pkg.tier})`,
      currency: pkg.currency,
      plan,
      requirements: { answers, notes: input.notes, extras: extraTitles },
      source: 'order',
    });
  }

  /** Shared project factory (orders and accepted proposals). Runs in one transaction. */
  async create(
    p: {
      buyerId: string;
      sellerId: string;
      serviceId?: string;
      packageId?: string;
      proposalId?: string;
      title: string;
      currency: string;
      plan: NewMilestone[];
      requirements: Record<string, unknown>;
      source: 'order' | 'proposal' | 'offer';
    },
    tx?: DbTx,
  ) {
    const run = async (t: DbTx) => {
      const total = p.plan.reduce((s, m) => s + m.amount, 0);
      const [project] = await t
        .insert(projects)
        .values({
          buyerId: p.buyerId,
          sellerId: p.sellerId,
          serviceId: p.serviceId ?? null,
          packageId: p.packageId ?? null,
          proposalId: p.proposalId ?? null,
          title: p.title,
          status: 'requirements_submitted',
          totalAmount: total,
          currency: p.currency,
          requirements: p.requirements,
        })
        .returning();
      if (!project) throw new Error('insert failed');
      await t.insert(projectParticipants).values([
        { projectId: project.id, userId: p.buyerId, role: 'buyer' },
        { projectId: project.id, userId: p.sellerId, role: 'seller' },
      ]);
      const today = new Date();
      const rows = await t
        .insert(milestones)
        .values(
          p.plan.map((m, i) => ({
            projectId: project.id,
            position: i + 1,
            title: m.title,
            acceptanceCriteria: m.acceptanceCriteria ?? null,
            amount: m.amount,
            currency: p.currency,
            plannedDue: new Date(today.getTime() + m.days * 86_400_000).toISOString().slice(0, 10),
          })),
        )
        .returning();
      await recordChange(t, {
        projectId: project.id,
        actorId: p.buyerId,
        type:
          p.source === 'order'
            ? 'project.ordered'
            : p.source === 'proposal'
              ? 'project.proposal_accepted'
              : 'project.offer_accepted',
        entityType: 'project',
        entityId: project.id,
        after: { status: project.status, total, milestones: rows.length },
        payload: { code: project.code, total },
      });
      return { project, milestones: rows };
    };
    return tx ? run(tx) : this.db.db.transaction(run);
  }

  private async sellerIsPublic(sellerId: string) {
    const [r] = await this.db.db
      .select({ done: sellerProfiles.onboardingCompletedAt, banned: users.bannedAt })
      .from(sellerProfiles)
      .innerJoin(users, eq(users.id, sellerProfiles.userId))
      .where(eq(sellerProfiles.userId, sellerId));
    return Boolean(r?.done && !r.banned);
  }

  // ---- access ---------------------------------------------------------------------

  /** Participant-scoped lookup. Everyone else (including other sellers/buyers) gets 404 (D-011). */
  async access(actor: RequestActor, projectId: string) {
    const [row] = await this.db.db
      .select({ project: projects, role: projectParticipants.role })
      .from(projects)
      .innerJoin(
        projectParticipants,
        and(eq(projectParticipants.projectId, projects.id), eq(projectParticipants.userId, actor.userId)),
      )
      .where(eq(projects.id, projectId));
    if (!row) throw new NotFoundException('Project not found');
    const role: 'buyer' | 'seller' =
      row.role === 'seller' || row.role === 'seller_member' ? 'seller' : 'buyer';
    return { project: row.project, role };
  }

  // ---- reads ----------------------------------------------------------------------

  async list(actor: RequestActor, cursor: string | undefined, limit: number) {
    const rows = await this.db.db
      .select()
      .from(projects)
      .innerJoin(
        projectParticipants,
        and(eq(projectParticipants.projectId, projects.id), eq(projectParticipants.userId, actor.userId)),
      )
      .where(cursor ? lt(projects.id, cursor) : undefined)
      .orderBy(desc(projects.id))
      .limit(limit + 1);
    const page = rows.slice(0, limit);
    const ids = page.map((r) => r.projects.id);
    const ms = ids.length
      ? await this.db.db.select().from(milestones).where(inArray(milestones.projectId, ids))
      : [];
    const otherIds = [
      ...new Set(
        page.map((r) => (r.projects.buyerId === actor.userId ? r.projects.sellerId : r.projects.buyerId)),
      ),
    ];
    const names = otherIds.length
      ? await this.db.db
          .select({ id: profiles.userId, name: profiles.displayName })
          .from(profiles)
          .where(inArray(profiles.userId, otherIds))
      : [];
    const items: ProjectListItem[] = page.map(({ projects: pr }) => {
      const myRole = pr.sellerId === actor.userId ? 'seller' : 'buyer';
      const other = myRole === 'seller' ? pr.buyerId : pr.sellerId;
      const mine = ms.filter((m) => m.projectId === pr.id).sort((a, b) => a.position - b.position);
      const health = computeHealth({
        projectStatus: pr.status,
        projectCreatedAt: pr.createdAt,
        now: new Date(),
        milestones: mine.map((m) => ({
          position: m.position,
          status: m.status,
          plannedDue: m.plannedDue,
          submittedAt: m.actualSubmittedAt,
          revisionCount: m.revisionCount,
        })),
      });
      const next = mine.find((m) => !['released', 'cancelled', 'refunded'].includes(m.status));
      return {
        id: pr.id,
        code: pr.code,
        title: pr.title,
        status: pr.status,
        progress: projectProgress(
          ms
            .filter((m) => m.projectId === pr.id)
            .map((m) => ({ amount: BigInt(m.amount), status: m.status })),
        ),
        totalAmount: pr.totalAmount,
        currency: pr.currency,
        myRole,
        counterparty: names.find((n) => n.id === other)?.name ?? 'Unknown',
        counterpartyId: other,
        health: health.health,
        healthReason: health.reason,
        nextMilestone: next ? { title: next.title, status: next.status, dueOn: next.plannedDue } : null,
        createdAt: pr.createdAt.toISOString(),
      };
    });
    return { items, nextCursor: rows.length > limit ? (page.at(-1)?.projects.id ?? null) : null };
  }

  async view(actor: RequestActor, projectId: string): Promise<ProjectView> {
    const { project: pr, role } = await this.access(actor, projectId);
    const ms = await this.db.db
      .select()
      .from(milestones)
      .where(eq(milestones.projectId, pr.id))
      .orderBy(asc(milestones.position));
    const pays = ms.length
      ? await this.db.db
          .select()
          .from(payments)
          .where(
            inArray(
              payments.milestoneId,
              ms.map((m) => m.id),
            ),
          )
          .orderBy(desc(payments.id))
      : [];
    const holds = ms.length
      ? await this.db.db
          .select()
          .from(escrowHolds)
          .where(
            inArray(
              escrowHolds.milestoneId,
              ms.map((m) => m.id),
            ),
          )
      : [];
    const [buyer] = await this.db.db
      .select({ name: profiles.displayName })
      .from(profiles)
      .where(eq(profiles.userId, pr.buyerId));
    const [seller] = await this.db.db
      .select({ name: profiles.displayName, slug: profiles.slug })
      .from(profiles)
      .where(eq(profiles.userId, pr.sellerId));
    const [svc] = pr.serviceId
      ? await this.db.db
          .select({ slug: services.slug, title: services.title, status: services.status })
          .from(services)
          .where(eq(services.id, pr.serviceId))
      : [];
    const settings = await this.fees.settings();
    const taskRows = await this.db.db
      .select({ milestoneId: tasks.milestoneId, status: tasks.status })
      .from(tasks)
      .where(eq(tasks.projectId, pr.id));
    const taskCounts = (milestoneId: string) => {
      const mine = taskRows.filter((t) => t.milestoneId === milestoneId);
      return { done: mine.filter((t) => t.status === 'done').length, total: mine.length };
    };

    const milestoneViews: MilestoneView[] = ms.map((m) => {
      const pay =
        pays.find((x) => x.milestoneId === m.id && (x.status === 'pending' || x.status === 'succeeded')) ??
        pays.find((x) => x.milestoneId === m.id);
      return {
        id: m.id,
        position: m.position,
        title: m.title,
        acceptanceCriteria: m.acceptanceCriteria,
        amount: m.amount,
        currency: m.currency,
        status: m.status,
        plannedDue: m.plannedDue,
        submittedAt: m.actualSubmittedAt?.toISOString() ?? null,
        approvedAt: m.approvedAt?.toISOString() ?? null,
        autoApproveAt: m.autoApproveAt?.toISOString() ?? null,
        revisionCount: m.revisionCount,
        submissionNote: m.submissionNote,
        revisionNote: m.revisionNote,
        quote: quoteFees(m.amount, settings),
        tasks: taskCounts(m.id),
        payment: pay
          ? { id: pay.id, status: pay.status, checkoutUrl: pay.status === 'pending' ? pay.checkoutUrl : null }
          : null,
        actions: this.actionsFor(pr.status, role, m.position, m.status),
      };
    });
    // Health is derived from facts on every read (never stored), so it cannot go stale.
    const health = computeHealth({
      projectStatus: pr.status,
      projectCreatedAt: pr.createdAt,
      now: new Date(),
      milestones: ms.map((m) => ({
        position: m.position,
        status: m.status,
        plannedDue: m.plannedDue,
        submittedAt: m.actualSubmittedAt,
        revisionCount: m.revisionCount,
      })),
    });
    const open = ms.filter((m) => !['released', 'cancelled', 'refunded'].includes(m.status));
    const dated = open
      .filter((m) => m.plannedDue)
      .sort((a, b) => (a.plannedDue! < b.plannedDue! ? -1 : 1))[0];
    const held = holds.filter((h) => h.status === 'held').reduce((s, h) => s + h.amount, 0);
    const released = holds.filter((h) => h.status === 'released').reduce((s, h) => s + h.amount, 0);
    const req = pr.requirements as ProjectView['requirements'];
    const first = ms[0];
    return {
      id: pr.id,
      code: pr.code,
      title: pr.title,
      status: pr.status,
      health: health.health,
      healthReason: health.reason,
      totalAmount: pr.totalAmount,
      currency: pr.currency,
      progress: projectProgress(
        ms.map((m) => {
          const t = taskCounts(m.id);
          return {
            amount: BigInt(m.amount),
            status: m.status as MilestoneStatus,
            taskDoneRatio: t.total ? t.done / t.total : 0,
          };
        }),
      ),
      myRole: role,
      buyer: { id: pr.buyerId, name: buyer?.name ?? 'Unknown' },
      seller: { id: pr.sellerId, name: seller?.name ?? 'Unknown', slug: seller?.slug ?? null },
      service: svc && svc.status === 'live' ? { slug: svc.slug, title: svc.title } : null,
      escrow: { held, released },
      requirements: { answers: req?.answers ?? [], notes: req?.notes },
      milestones: milestoneViews,
      createdAt: pr.createdAt.toISOString(),
      startedAt: pr.startedAt?.toISOString() ?? null,
      completedAt: pr.completedAt?.toISOString() ?? null,
      canAccept: role === 'seller' && pr.status === 'requirements_submitted' && first?.status === 'funded',
      canDecline: pr.status === 'requirements_submitted',
      currentMilestoneId: open[0]?.id ?? null,
      nextDeadline: dated ? { milestoneId: dated.id, title: dated.title, date: dated.plannedDue! } : null,
    };
  }

  /** Which buttons the viewer may press on a milestone right now (server-computed, re-checked on every call). */
  private actionsFor(
    projectStatus: string,
    role: 'buyer' | 'seller',
    position: number,
    status: MilestoneStatus,
  ): MilestoneAction[] {
    const out: MilestoneAction[] = [];
    const projectActive = projectStatus === 'active';
    const actor = role;
    if (
      role === 'buyer' &&
      status === 'pending' &&
      (projectActive || (projectStatus === 'requirements_submitted' && position === 1))
    ) {
      out.push('fund');
    }
    if (!projectActive) return out;
    const events = availableEvents(milestoneMachine, status, actor);
    if (events.includes('start')) out.push('start');
    if (events.includes('submit')) out.push('submit');
    if (events.includes('request_revision')) out.push('request_revision');
    if (events.includes('approve')) out.push('approve');
    return out;
  }
}
