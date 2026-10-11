import { sql, type DbClient, type SQL } from '@glasswork/db';
import type { ServiceSearchQuery } from '@glasswork/shared';
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

    const sort = q.sort ?? (term ? 'relevance' : 'newest');
    const order: SQL =
      sort === 'price_asc'
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
      where ${sql.join(where, sql` and `)}
      order by ${order}
      limit ${q.limit + 1} offset ${offset}
    `);
    const rows = result.rows;
    const ids = rows.slice(0, q.limit).map((r) => r.id);
    return { ids, nextCursor: rows.length > q.limit ? encodeCursor(offset + q.limit) : null };
  }
}
