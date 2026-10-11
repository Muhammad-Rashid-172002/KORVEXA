import { accounts, sql, verifications, and, eq, inArray, type DbClient } from '@glasswork/db';
import {
  computeSellerLevel,
  SELLER_LEVELS,
  type SellerStatsView,
  type VerificationKind,
} from '@glasswork/shared';
import { Inject, Injectable } from '@nestjs/common';
import { DB } from '../../infra/tokens';

export interface SellerTrust extends SellerStatsView {
  badges: VerificationKind[];
}

const emptyStats = (): SellerTrust => ({
  completedProjects: 0,
  reviewCount: 0,
  avgRating: null,
  onTimeRate: null,
  level: 'new',
  levelLabel: 'New seller',
  subRatings: { communication: null, quality: null, timeliness: null },
  badges: [],
});
const round = (n: number | null, d = 1) => (n === null ? null : Math.round(n * 10 ** d) / 10 ** d);

/**
 * The single source for a seller's public trust data: level, ratings and verified badges, all computed from
 * real rows (completed projects, public reviews, milestone dates, verification decisions). Nothing is stored,
 * so it can never drift or be hand-edited.
 */
@Injectable()
export class SellerStatsService {
  constructor(@Inject(DB) private readonly db: DbClient) {}

  async get(ids: string[]): Promise<Map<string, SellerTrust>> {
    const out = new Map<string, SellerTrust>();
    const uniq = [...new Set(ids)];
    if (!uniq.length) return out;
    for (const id of uniq) out.set(id, emptyStats());
    const list = sql.join(
      uniq.map((i) => sql`${i}::uuid`),
      sql`, `,
    );

    const rows = await this.db.db.execute<{
      id: string;
      completed: number;
      review_count: number;
      avg: number | null;
      comm: number | null;
      qual: number | null;
      time: number | null;
      on_time: number | null;
    }>(sql`
      select sp.user_id as id,
        (select count(*) from projects p where p.seller_id = sp.user_id and p.status in ('completed', 'reviewed'))::int as completed,
        (select count(*) from reviews r where r.subject_seller_id = sp.user_id and r.visibility = 'public')::int as review_count,
        (select avg(r.rating_overall) from reviews r where r.subject_seller_id = sp.user_id and r.visibility = 'public')::float as avg,
        (select avg(r.rating_communication) from reviews r where r.subject_seller_id = sp.user_id and r.visibility = 'public')::float as comm,
        (select avg(r.rating_quality) from reviews r where r.subject_seller_id = sp.user_id and r.visibility = 'public')::float as qual,
        (select avg(r.rating_timeliness) from reviews r where r.subject_seller_id = sp.user_id and r.visibility = 'public')::float as time,
        (select (count(*) filter (where m.actual_submitted_at is not null and m.planned_due is not null and m.actual_submitted_at::date <= m.planned_due))::float
                / nullif(count(*) filter (where m.planned_due is not null), 0)
           from milestones m join projects p on p.id = m.project_id
          where p.seller_id = sp.user_id and m.status = 'released')::float as on_time
      from seller_profiles sp where sp.user_id in (${list})
    `);
    for (const r of rows.rows) {
      const base = {
        completedProjects: Number(r.completed),
        reviewCount: Number(r.review_count),
        avgRating: r.avg === null ? null : Number(r.avg),
        onTimeRate: r.on_time === null ? null : Number(r.on_time),
      };
      const level = computeSellerLevel(base);
      const t = out.get(r.id)!;
      Object.assign(t, base, {
        avgRating: round(base.avgRating, 2),
        onTimeRate: round(base.onTimeRate, 3),
        level,
        levelLabel: SELLER_LEVELS.find((l) => l.key === level)!.label,
        subRatings: {
          communication: round(r.comm === null ? null : Number(r.comm), 2),
          quality: round(r.qual === null ? null : Number(r.qual), 2),
          timeliness: round(r.time === null ? null : Number(r.time), 2),
        },
      });
      // Level uses the exact (unrounded) metrics; rounded values are for display only.
    }

    const verified = await this.db.db
      .select({ userId: verifications.userId, kind: verifications.kind })
      .from(verifications)
      .where(and(inArray(verifications.userId, uniq), eq(verifications.status, 'verified')));
    for (const v of verified) out.get(v.userId)?.badges.push(v.kind);
    // A linked GitHub account is proof the platform itself can check (OAuth), so it needs no admin review.
    const gh = await this.db.db
      .select({ userId: accounts.userId })
      .from(accounts)
      .where(and(inArray(accounts.userId, uniq), eq(accounts.providerId, 'github')));
    for (const g of gh) {
      const t = out.get(g.userId);
      if (t && !t.badges.includes('github')) t.badges.push('github');
    }
    for (const t of out.values()) t.badges.sort();
    return out;
  }

  async one(id: string): Promise<SellerTrust> {
    return (await this.get([id])).get(id) ?? emptyStats();
  }
}
