import { sql, type DbClient, type SQL } from '@glasswork/db';
import { SELLER_LEVELS, type ServiceSearchQuery } from '@glasswork/shared';
import { Inject, Injectable } from '@nestjs/common';
import { DB } from '../../infra/tokens';

export interface SearchResult {
  ids: string[];
  nextCursor: string | null;
}

/** Swappable search backend (Postgres now, Meilisearch later) — brief §5. */
export abstract class SearchService {
  abstract searchServices(query: ServiceSearchQuery): Promise<SearchResult>;
}

const encodeCursor = (offset: number) => Buffer.from(JSON.stringify({ o: offset })).toString('base64url');
function decodeCursor(cursor: string | undefined): number {
  if (!cursor) return 0;
  try {
    const o = (JSON.parse(Buffer.from(cursor, 'base64url').toString()) as { o?: unknown }).o;
    return typeof o === 'number' && Number.isInteger(o) && o >= 0 && o < 10_000 ? o : 0;
  } catch {
    return 0;
  }
}

/**
 * Postgres full-text (`websearch_to_tsquery`, weighted title > description) + `pg_trgm` title similarity.
 * RANKING NEUTRALITY (D-002): the ORDER BY below may only read text relevance, publish date and price.
 * It must never reference `operated_by_platform` or any owner/affiliation column; a test enforces this.
 *
 * Cursors are opaque offsets: relevance scores aren't keyset-friendly, and result sets are capped at 10k.
 */
@Injectable()
export class PostgresSearchService extends SearchService {
  constructor(@Inject(DB) private readonly db: DbClient) {
    super();
  }

  async searchServices(q: ServiceSearchQuery): Promise<SearchResult> {
    const offset = decodeCursor(q.cursor);
    const term = q.q?.trim() || undefined;

    const where: SQL[] = [sql`s.status = 'live'`, sql`p.min_price is not null`];
    if (term) {
      where.push(
        sql`(s.search_vector @@ websearch_to_tsquery('english', ${term}) or similarity(s.title, ${term}) > 0.25)`,
      );
    }
    if (q.category) {
      where.push(
        sql`(c.slug = ${q.category} or c.parent_id in (select id from categories where slug = ${q.category}))`,
      );
    }
    if (q.minPrice !== undefined) where.push(sql`p.max_price >= ${q.minPrice}`);
    if (q.maxPrice !== undefined) where.push(sql`p.min_price <= ${q.maxPrice}`);
    if (q.maxDelivery !== undefined) where.push(sql`p.min_days <= ${q.maxDelivery}`);

    // Trust filters use REAL data only (D-061 → Phase 5): sellers without reviews/verifications never match them.
    if (q.minRating !== undefined) where.push(sql`st.review_count > 0 and st.avg_rating >= ${q.minRating}`);
    if (q.level && q.level !== 'new') {
      const c = SELLER_LEVELS.find((l) => l.key === q.level)!.criteria;
      where.push(
        sql`(st.completed >= ${c.completedProjects} and st.review_count >= ${c.reviewCount} and coalesce(st.avg_rating, 0) >= ${c.avgRating} and coalesce(st.on_time, 0) >= ${c.onTimeRate})`,
      );
    }
    if (q.verifiedOnly) {
      where.push(
        sql`(exists (select 1 from verifications v where v.user_id = s.seller_id and v.status = 'verified') or exists (select 1 from accounts a where a.user_id = s.seller_id and a.provider_id = 'github'))`,
      );
    }

    const sort = q.sort ?? (term ? 'relevance' : 'newest');
    const order: SQL =
      sort === 'rating'
        ? sql`st.avg_rating desc nulls last, st.review_count desc, s.published_at desc, s.id desc`
        : sort === 'price_asc'
          ? sql`p.min_price asc, s.published_at desc, s.id desc`
          : sort === 'price_desc'
            ? sql`p.min_price desc, s.published_at desc, s.id desc`
            : sort === 'relevance' && term
              ? sql`(ts_rank_cd(s.search_vector, websearch_to_tsquery('english', ${term})) + similarity(s.title, ${term})) desc, s.published_at desc, s.id desc`
              : sql`s.published_at desc, s.id desc`;

    const result = await this.db.db.execute<{ id: string }>(sql`
      select s.id
      from services s
      join seller_profiles sp on sp.user_id = s.seller_id and sp.onboarding_completed_at is not null
      join users u on u.id = s.seller_id and u.banned_at is null
      join categories c on c.id = s.category_id
      join lateral (
        select min(price_amount) as min_price, max(price_amount) as max_price, min(delivery_days) as min_days
        from service_packages where service_id = s.id
      ) p on true
      join lateral (
        select
          (select count(*) from projects pr where pr.seller_id = s.seller_id and pr.status in ('completed', 'reviewed'))::int as completed,
          (select count(*) from reviews r where r.subject_seller_id = s.seller_id and r.visibility = 'public')::int as review_count,
          (select avg(r.rating_overall) from reviews r where r.subject_seller_id = s.seller_id and r.visibility = 'public')::float as avg_rating,
          (select (count(*) filter (where m.actual_submitted_at is not null and m.planned_due is not null and m.actual_submitted_at::date <= m.planned_due))::float
                  / nullif(count(*) filter (where m.planned_due is not null), 0)
             from milestones m join projects pr on pr.id = m.project_id
            where pr.seller_id = s.seller_id and m.status = 'released')::float as on_time
      ) st on true
      where ${sql.join(where, sql` and `)}
      order by ${order}
      limit ${q.limit + 1} offset ${offset}
    `);
    const rows = result.rows;
    const ids = rows.slice(0, q.limit).map((r) => r.id);
    return { ids, nextCursor: rows.length > q.limit ? encodeCursor(offset + q.limit) : null };
  }
}
