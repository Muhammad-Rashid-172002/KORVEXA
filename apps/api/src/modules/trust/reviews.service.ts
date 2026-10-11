import {
  and,
  auditLogs,
  desc,
  eq,
  inArray,
  lt,
  milestones,
  profiles,
  projectEvents,
  projects,
  reviewReplies,
  reviews,
  services,
  type DbClient,
} from '@glasswork/db';
import { projectMachine, transition, type FinalReviewInput, type ReviewView } from '@glasswork/shared';
import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { RequestActor } from '../../auth/session.service';
import { DB } from '../../infra/tokens';
import { NotificationsService } from '../notifications/notifications.service';
import { ProjectsService } from '../orders/projects.service';

const isUnique = (err: unknown) => (err as { cause?: { code?: string } }).cause?.code === '23505';

@Injectable()
export class ReviewsService {
  constructor(
    @Inject(DB) private readonly db: DbClient,
    private readonly projectsSvc: ProjectsService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Private feedback to the seller after a milestone was paid (never public, never in ratings). */
  async milestoneFeedback(actor: RequestActor, milestoneId: string, input: { rating: number; body: string }) {
    const [m] = await this.db.db.select().from(milestones).where(eq(milestones.id, milestoneId));
    if (!m) throw new NotFoundException('Milestone not found');
    const { project, role } = await this.projectsSvc.access(actor, m.projectId);
    if (role !== 'buyer') throw new UnprocessableEntityException('Only the buyer can leave feedback');
    if (m.status !== 'released')
      throw new UnprocessableEntityException('Feedback opens once the milestone has been paid');
    try {
      await this.db.db.insert(reviews).values({
        projectId: project.id,
        milestoneId,
        authorId: actor.userId,
        subjectSellerId: project.sellerId,
        visibility: 'private',
        ratingOverall: input.rating,
        body: input.body,
      });
    } catch (err) {
      if (isUnique(err)) throw new ConflictException('You already left feedback for this milestone');
      throw err;
    }
    return { ok: true };
  }

  /**
   * The public final review. Only the paying buyer of a COMPLETED project with at least one paid milestone
   * may leave it, once. It moves the project completed → reviewed.
   */
  async finalReview(actor: RequestActor, projectId: string, input: FinalReviewInput) {
    const { project, role } = await this.projectsSvc.access(actor, projectId);
    if (role !== 'buyer') throw new UnprocessableEntityException('Only the buyer can review the seller');
    if (project.status !== 'completed') {
      throw new UnprocessableEntityException(
        project.status === 'reviewed'
          ? 'You already reviewed this project'
          : 'You can review once the project is completed',
      );
    }
    const paid = await this.db.db
      .select({ id: milestones.id })
      .from(milestones)
      .where(and(eq(milestones.projectId, projectId), eq(milestones.status, 'released')));
    if (!paid.length)
      throw new UnprocessableEntityException('Only buyers who paid for completed work can review');

    try {
      await this.db.db.transaction(async (tx) => {
        await tx.insert(reviews).values({
          projectId,
          authorId: actor.userId,
          subjectSellerId: project.sellerId,
          visibility: 'public',
          ratingOverall: input.ratingOverall,
          ratingCommunication: input.ratingCommunication,
          ratingQuality: input.ratingQuality,
          ratingTimeliness: input.ratingTimeliness,
          body: input.body,
        });
        const next = transition(projectMachine, project.status, 'review', 'buyer');
        await tx.update(projects).set({ status: next }).where(eq(projects.id, projectId));
        await tx.insert(projectEvents).values({
          projectId,
          actorId: actor.userId,
          type: 'project.reviewed',
          payload: { rating: input.ratingOverall },
        });
        await tx.insert(auditLogs).values({
          actorId: actor.userId,
          action: 'project.reviewed',
          entityType: 'project',
          entityId: projectId,
          before: { status: project.status },
          after: { status: next },
        });
      });
    } catch (err) {
      if (isUnique(err)) throw new ConflictException('You already reviewed this project');
      throw err;
    }
    await this.notifications.notify([project.sellerId], {
      type: 'review.received',
      title: `You received a ${input.ratingOverall}-star review`,
      body: input.body.slice(0, 140) || null,
      url: `/projects/${projectId}`,
    });
    return { ok: true };
  }

  /** One reply per review, from the reviewed seller, on public reviews only. */
  async reply(actor: RequestActor, reviewId: string, body: string) {
    const [r] = await this.db.db
      .select()
      .from(reviews)
      .where(
        and(
          eq(reviews.id, reviewId),
          eq(reviews.subjectSellerId, actor.userId),
          eq(reviews.visibility, 'public'),
        ),
      );
    // Not your review (or a private one): looks like it doesn't exist.
    if (!r) throw new NotFoundException('Review not found');
    try {
      await this.db.db.insert(reviewReplies).values({ reviewId, authorId: actor.userId, body });
    } catch (err) {
      if (isUnique(err)) throw new ConflictException('You already replied to this review');
      throw err;
    }
    return { ok: true };
  }

  async listPublic(sellerId: string, cursor: string | undefined, limit: number) {
    const rows = await this.db.db
      .select({ r: reviews, projectTitle: projects.title, serviceTitle: services.title })
      .from(reviews)
      .innerJoin(projects, eq(projects.id, reviews.projectId))
      .leftJoin(services, eq(services.id, projects.serviceId))
      .where(
        and(
          eq(reviews.subjectSellerId, sellerId),
          eq(reviews.visibility, 'public'),
          cursor ? lt(reviews.id, cursor) : undefined,
        ),
      )
      .orderBy(desc(reviews.id))
      .limit(limit + 1);
    const page = rows.slice(0, limit);
    const ids = page.map((p) => p.r.id);
    const replies = ids.length
      ? await this.db.db.select().from(reviewReplies).where(inArray(reviewReplies.reviewId, ids))
      : [];
    const authors = ids.length
      ? await this.db.db
          .select({ id: profiles.userId, name: profiles.displayName })
          .from(profiles)
          .where(
            inArray(
              profiles.userId,
              page.map((p) => p.r.authorId),
            ),
          )
      : [];
    const items: ReviewView[] = page.map(({ r, projectTitle, serviceTitle }) => {
      const rep = replies.find((x) => x.reviewId === r.id);
      // Reviewer shown by first name + initial only (PII minimisation).
      const full = authors.find((a) => a.id === r.authorId)?.name ?? 'Buyer';
      const [first, ...rest] = full.split(' ');
      return {
        id: r.id,
        author: { name: rest.length ? `${first} ${rest[rest.length - 1]![0]}.` : first! },
        ratingOverall: r.ratingOverall,
        ratingCommunication: r.ratingCommunication,
        ratingQuality: r.ratingQuality,
        ratingTimeliness: r.ratingTimeliness,
        body: r.body,
        projectTitle: serviceTitle ?? projectTitle,
        createdAt: r.createdAt.toISOString(),
        reply: rep ? { body: rep.body, createdAt: rep.createdAt.toISOString() } : null,
      };
    });
    return { items, nextCursor: rows.length > limit ? (page.at(-1)?.r.id ?? null) : null };
  }

  /** What the viewer may do/see for a project: reviewability, their feedback, and (for sellers) private feedback received. */
  async forProject(actor: RequestActor, projectId: string) {
    const { project, role } = await this.projectsSvc.access(actor, projectId);
    const rows = await this.db.db.select().from(reviews).where(eq(reviews.projectId, projectId));
    const final = rows.find((r) => r.visibility === 'public');
    const feedback = rows.filter((r) => r.visibility === 'private');
    const released = await this.db.db
      .select({ id: milestones.id })
      .from(milestones)
      .where(and(eq(milestones.projectId, projectId), eq(milestones.status, 'released')));
    return {
      canReview: role === 'buyer' && project.status === 'completed' && released.length > 0 && !final,
      review: final
        ? { ratingOverall: final.ratingOverall, body: final.body, createdAt: final.createdAt.toISOString() }
        : null,
      feedback: feedback.map((f) => ({ milestoneId: f.milestoneId!, rating: f.ratingOverall, body: f.body })),
      feedbackOpen:
        role === 'buyer'
          ? released.map((m) => m.id).filter((id) => !feedback.some((f) => f.milestoneId === id))
          : [],
    };
  }
}
