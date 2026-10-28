import { assertNoSeedData, bootstrapAdminsForTest, findSeedData } from './prod-guard-helpers';
import { createDb, eq, users } from '@glasswork/db';
import { inject, describe, expect, it } from 'vitest';
import { uniqueEmail } from './helpers';

describe('production guards (D-111)', () => {
  const url = inject('databaseUrl');

  it('a freshly migrated database contains zero seed rows', async () => {
    expect(await findSeedData(url)).toEqual([]);
    await expect(assertNoSeedData(url)).resolves.toBeUndefined();
  });

  it('refuses a database containing dev seed accounts', async () => {
    const { db, pool } = createDb(url, { max: 1 });
    const email = `guard-${Date.now()}@dev.glasswork.test`;
    try {
      await db.insert(users).values({ email, name: 'Dev Seed', isSeed: true });
      const found = await findSeedData(url);
      expect(found.map((f) => f.table).join()).toMatch(/users/);
      await expect(assertNoSeedData(url)).rejects.toThrow(/Refusing to start/);
    } finally {
      await db.delete(users).where(eq(users.email, email));
      await pool.end();
    }
    expect(await findSeedData(url)).toEqual([]);
  });

  it('bootstrap-admin creates admins with the right scopes, idempotently, and rejects bad input', async () => {
    const email = uniqueEmail('founder');
    const raw = `${email}|Founder One|product,operations`;
    await bootstrapAdminsForTest(url, raw);
    await bootstrapAdminsForTest(url, raw);
    const { db, pool } = createDb(url, { max: 1 });
    try {
      const rows = await db.select().from(users).where(eq(users.email, email));
      expect(rows).toHaveLength(1);
      expect(rows[0]!.roles).toContain('admin');
      expect([...rows[0]!.adminScopes].sort()).toEqual(['operations', 'product']);
      expect(rows[0]!.emailVerified).toBe(true);
      await db.delete(users).where(eq(users.email, email));
    } finally {
      await pool.end();
    }
    await expect(bootstrapAdminsForTest(url, 'not-an-email|X|product')).rejects.toThrow(
      /Invalid admin email/,
    );
    await expect(bootstrapAdminsForTest(url, `${uniqueEmail()}|X|root`)).rejects.toThrow(/Unknown scope/);
  });
});
