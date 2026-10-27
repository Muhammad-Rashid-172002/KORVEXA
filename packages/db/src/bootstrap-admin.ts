/**
 * Creates the first admin accounts in a fresh production database (no seeded passwords).
 *   BOOTSTRAP_ADMINS="rashid@example.org|Muhammad Rashid|product,growth,operations;taha@..|Name|growth"
 * Each person then opens "Forgot password" on the site, receives a one-time reset link by email and chooses their
 * own password. Idempotent: re-running only (re)applies roles and scopes.
 */
import { and, eq } from 'drizzle-orm';
import { createDb } from './client';
import { users } from './schema';

type Scope = 'product' | 'growth' | 'operations';
const SCOPES: Scope[] = ['product', 'growth', 'operations'];

export function parseAdmins(raw: string): { email: string; name: string; scopes: Scope[] }[] {
  return raw
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((entry) => {
      const [email = '', name = '', scopeList = ''] = entry.split('|').map((p) => p.trim());
      const scopes = scopeList
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean) as Scope[];
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error(`Invalid admin email: "${email}"`);
      if (!name) throw new Error(`Missing name for ${email}`);
      for (const s of scopes) if (!SCOPES.includes(s)) throw new Error(`Unknown scope "${s}" for ${email}`);
      return { email: email.toLowerCase(), name, scopes: scopes.length ? scopes : SCOPES };
    });
}

export async function bootstrapAdmins(databaseUrl: string, raw: string): Promise<string[]> {
  const admins = parseAdmins(raw);
  const { db, pool } = createDb(databaseUrl, { max: 1 });
  const done: string[] = [];
  try {
    for (const a of admins) {
      const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, a.email));
      if (existing[0]) {
        await db
          .update(users)
          .set({ roles: ['buyer', 'admin'], adminScopes: a.scopes })
          .where(and(eq(users.id, existing[0].id)));
      } else {
        await db.insert(users).values({
          email: a.email,
          name: a.name,
          emailVerified: true,
          roles: ['buyer', 'admin'],
          adminScopes: a.scopes,
        });
      }
      done.push(a.email);
    }
  } finally {
    await pool.end();
  }
  return done;
}

if (require.main === module) {
  const url = process.env.DATABASE_URL;
  const raw = process.env.BOOTSTRAP_ADMINS;
  if (!url || !raw) {
    console.error('DATABASE_URL and BOOTSTRAP_ADMINS are required');
    process.exit(1);
  }
  bootstrapAdmins(url, raw)
    .then((emails) => {
      console.warn(`✓ admin accounts ready: ${emails.join(', ')}`);
      console.warn('Each admin must now use "Forgot password" on the site to set a password.');
    })
    .catch((e: unknown) => {
      console.error(e);
      process.exit(1);
    });
}
