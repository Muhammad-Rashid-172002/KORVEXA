/**
 * Production guard (DECISIONS D-107): a production database must contain no dev or demo seed data.
 * Looks for any row flagged `is_seed` in any table, and for accounts on the reserved `.glasswork.test` domains.
 */
import { createDb } from './client';

export interface SeedFinding {
  table: string;
  rows: number;
}

export async function findSeedData(databaseUrl: string): Promise<SeedFinding[]> {
  const { pool } = createDb(databaseUrl, { max: 1 });
  try {
    const cols = await pool.query<{ table_name: string }>(
      `select table_name from information_schema.columns
       where table_schema = 'public' and column_name = 'is_seed'`,
    );
    const out: SeedFinding[] = [];
    for (const { table_name } of cols.rows) {
      // table_name comes from information_schema, never from user input.
      const r = await pool.query<{ n: string }>(
        `select count(*)::text as n from "${table_name.replace(/"/g, '""')}" where is_seed`,
      );
      const n = Number(r.rows[0]?.n ?? 0);
      if (n > 0) out.push({ table: table_name, rows: n });
    }
    const t = await pool.query<{ n: string }>(
      `select count(*)::text as n from users where email like '%.glasswork.test'`,
    );
    const n = Number(t.rows[0]?.n ?? 0);
    if (n > 0) out.push({ table: 'users (reserved .glasswork.test emails)', rows: n });
    return out;
  } finally {
    await pool.end();
  }
}

export async function assertNoSeedData(databaseUrl: string): Promise<void> {
  const found = await findSeedData(databaseUrl);
  if (found.length === 0) return;
  const list = found.map((f) => `${f.table}: ${f.rows}`).join(', ');
  throw new Error(
    `Refusing to start: the production database contains dev/demo seed data (${list}). Use a clean database.`,
  );
}

if (require.main === module) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }
  findSeedData(url)
    .then((f) => {
      if (f.length) {
        console.error('✗ seed data found:', f);
        process.exit(1);
      }
      console.warn('✓ no seed data');
    })
    .catch((e: unknown) => {
      console.error(e);
      process.exit(1);
    });
}
