import { sql, type DbClient } from '@glasswork/db';
import type { SellerAnalyticsView } from '@glasswork/shared';
import { Inject, Injectable } from '@nestjs/common';
import { DB } from '../../infra/tokens';
import { SellerStatsService } from '../trust/stats.service';
import { responseHours } from './response-time';

/**
 * The seller's own numbers, computed from real rows only: released transfers, proposals, chat reply times,
 * milestone dates and reviews. Seeded demo rows never count (D-027). Nothing is estimated or stored, and a
 * metric with no data is `null`, never zero, so the UI can say "not enough data yet".
 */
@Injectable()
export class AnalyticsService {
  constructor(
    @Inject(DB) private readonly db: DbClient,
    private readonly stats: SellerStatsService,
  ) {}

  async forSeller(sellerId: string): Promise<SellerAnalyticsView> {
    const [money, props, repeat, resp, trust] = await Promise.all([
      this.db.db.execute<{ total: string; last30: string; held: string }>(sql`
        select
          coalesce((select sum(t.net_amount) from transfers t join escrow_holds h on h.id = t.escrow_hold_id
                     join milestones m on m.id = h.milestone_id join projects p on p.id = m.project_id
                    where t.seller_id = ${sellerId}::uuid and t.status = 'completed' and t.currency = 'USD' and not p.is_seed), 0) as total,
          coalesce((select sum(t.net_amount) from transfers t join escrow_holds h on h.id = t.escrow_hold_id
                     join milestones m on m.id = h.milestone_id join projects p on p.id = m.project_id
                    where t.seller_id = ${sellerId}::uuid and t.status = 'completed' and t.currency = 'USD' and not p.is_seed
                      and t.created_at >= now() - interval '30 days'), 0) as last30,
          coalesce((select sum(h.amount - h.seller_commission_amount) from escrow_holds h
                     join milestones m on m.id = h.milestone_id join projects p on p.id = m.project_id
                    where p.seller_id = ${sellerId}::uuid and h.status = 'held' and h.currency = 'USD' and not p.is_seed), 0) as held
      `),
      this.db.db.execute<{ sent: number; accepted: number }>(sql`
        select count(*) filter (where pr.status <> 'withdrawn')::int as sent,
               count(*) filter (where pr.status = 'accepted')::int as accepted
          from proposals pr join briefs b on b.id = pr.brief_id
         where pr.seller_id = ${sellerId}::uuid and not b.is_seed
      `),
      this.db.db.execute<{ buyers: number; repeat: number }>(sql`
        select count(*)::int as buyers, count(*) filter (where n >= 2)::int as repeat from (
          select p.buyer_id, count(*) as n from projects p
           where p.seller_id = ${sellerId}::uuid and p.status in ('completed', 'reviewed') and not p.is_seed
           group by p.buyer_id) x
      `),
      responseHours(this.db, [sellerId]),
      this.stats.get([sellerId]),
    ]);
    const m = money.rows[0]!;
    const pr = props.rows[0]!;
    const rp = repeat.rows[0]!;
    const rt = resp.get(sellerId)!;
    const t = trust.get(sellerId)!;
    const total = Number(m.total);
    const held = Number(m.held);
    const rate = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 1000 : null);
    const onTimeSample = t.onTimeRate === null ? 0 : t.completedProjects;
    return {
      periodDays: 30,
      currency: 'USD',
      earnings: { total, last30Days: Number(m.last30), pendingInEscrow: held },
      proposals: { sent: pr.sent, accepted: pr.accepted, conversionRate: rate(pr.accepted, pr.sent) },
      responseHours: { median: rt.median, sampleSize: rt.sampleSize },
      onTime: { rate: t.onTimeRate, sampleSize: onTimeSample },
      repeatBuyers: { rate: rate(rp.repeat, rp.buyers), buyers: rp.buyers, repeat: rp.repeat },
      completedProjects: t.completedProjects,
      rating: { average: t.avgRating, count: t.reviewCount },
      hasData: total > 0 || held > 0 || pr.sent > 0 || rt.sampleSize > 0 || t.completedProjects > 0,
    };
  }
}
