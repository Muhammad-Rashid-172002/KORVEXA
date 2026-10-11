import { sql, type DbClient } from '@glasswork/db';

export interface ResponseTime {
  median: number | null;
  sampleSize: number;
}

/**
 * Real first-reply times: for direct chats that someone else started, the hours between their first message
 * and the seller's first answer (last 90 days). Conversations the seller opened themselves are not counted.
 */
export async function responseHours(db: DbClient, sellerIds: string[]): Promise<Map<string, ResponseTime>> {
  const out = new Map<string, ResponseTime>();
  const ids = [...new Set(sellerIds)];
  for (const id of ids) out.set(id, { median: null, sampleSize: 0 });
  if (!ids.length) return out;
  const list = sql.join(
    ids.map((i) => sql`${i}::uuid`),
    sql`, `,
  );
  const rows = await db.db.execute<{ seller_id: string; hours: number }>(sql`
    select cm.user_id as seller_id,
           extract(epoch from (r.created_at - q.created_at)) / 3600.0 as hours
      from conversation_members cm
      join conversations c on c.id = cm.conversation_id and c.kind = 'direct'
      join lateral (
        select m.created_at from messages m
         where m.conversation_id = c.id and m.kind = 'text' and m.sender_id <> cm.user_id
         order by m.id limit 1) q on true
      join lateral (
        select m.created_at from messages m
         where m.conversation_id = c.id and m.kind = 'text' and m.sender_id = cm.user_id and m.created_at > q.created_at
         order by m.id limit 1) r on true
     where cm.user_id in (${list})
       and q.created_at > now() - interval '90 days'
       and (select m.sender_id from messages m where m.conversation_id = c.id order by m.id limit 1) <> cm.user_id
  `);
  const bySeller = new Map<string, number[]>();
  for (const r of rows.rows)
    bySeller.set(r.seller_id, [...(bySeller.get(r.seller_id) ?? []), Number(r.hours)]);
  for (const [id, hs] of bySeller) {
    hs.sort((a, b) => a - b);
    const mid = Math.floor(hs.length / 2);
    const median = hs.length % 2 ? hs[mid]! : (hs[mid - 1]! + hs[mid]!) / 2;
    out.set(id, { median: Math.round(median * 10) / 10, sampleSize: hs.length });
  }
  return out;
}
