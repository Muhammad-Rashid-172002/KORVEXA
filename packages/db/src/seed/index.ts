/**
 * Development seed (DECISIONS D-027). Refuses to run in production; every row is tagged is_seed=true.
 * Idempotent: re-running updates the same seed users instead of duplicating them.
 */
import { SETTING_KEYS } from '@glasswork/shared';
import { createDb, type Database } from '../client';
import { hashPassword } from '../password';
import { accounts, platformSettings, profiles, users } from '../schema';

export const SEED_PASSWORD = 'Glasswork-dev-123!';

type SeedUser = {
  email: string;
  name: string;
  roles: ('buyer' | 'seller' | 'admin' | 'support')[];
  adminScopes?: ('product' | 'growth' | 'operations')[];
  headline: string;
};

/** Generic dev personas — clearly fake, never shown as real marketplace data. */
const SEED_USERS: SeedUser[] = [
  {
    email: 'buyer@dev.glasswork.test',
    name: 'Dev Buyer',
    roles: ['buyer'],
    headline: '[DEV SEED] Buyer account',
  },
  {
    email: 'seller@dev.glasswork.test',
    name: 'Dev Seller',
    roles: ['buyer', 'seller'],
    headline: '[DEV SEED] Seller account',
  },
  {
    email: 'admin@dev.glasswork.test',
    name: 'Dev Admin',
    roles: ['buyer', 'admin'],
    adminScopes: ['product', 'growth', 'operations'],
    headline: '[DEV SEED] Admin with all scopes',
  },
  {
    email: 'support@dev.glasswork.test',
    name: 'Dev Support',
    roles: ['support'],
    headline: '[DEV SEED] Support agent',
  },
];

/** Placeholder fee values — real values are decided before Phase 3 (DECISIONS D-045). */
const SEED_SETTINGS = [
  {
    key: SETTING_KEYS.buyerServiceFeeBps,
    value: 0,
    description: '[DEV PLACEHOLDER] buyer service fee, basis points',
  },
  {
    key: SETTING_KEYS.buyerServiceFeeMinAmount,
    value: 0,
    description: '[DEV PLACEHOLDER] buyer fee minimum, minor units',
  },
  {
    key: SETTING_KEYS.sellerCommissionBps,
    value: 0,
    description: '[DEV PLACEHOLDER] seller commission, basis points',
  },
  {
    key: SETTING_KEYS.sellerCommissionMinAmount,
    value: 0,
    description: '[DEV PLACEHOLDER] seller commission minimum, minor units',
  },
  {
    key: SETTING_KEYS.autoApproveDays,
    value: 5,
    description: 'Auto-approve submitted milestones after N days (D-022)',
  },
];

export async function seed(db: Database): Promise<{ users: number; settings: number }> {
  const passwordHash = await hashPassword(SEED_PASSWORD);
  for (const u of SEED_USERS) {
    const [row] = await db
      .insert(users)
      .values({
        email: u.email,
        name: u.name,
        emailVerified: true,
        roles: u.roles,
        adminScopes: u.adminScopes ?? [],
        activeMode: u.roles.includes('seller') ? 'seller' : 'buyer',
        isSeed: true,
      })
      .onConflictDoUpdate({
        target: users.email,
        set: {
          name: u.name,
          roles: u.roles,
          adminScopes: u.adminScopes ?? [],
          emailVerified: true,
          isSeed: true,
        },
      })
      .returning({ id: users.id });
    if (!row) throw new Error(`failed to upsert ${u.email}`);

    await db
      .insert(accounts)
      .values({ userId: row.id, providerId: 'credential', accountId: row.id, password: passwordHash })
      .onConflictDoUpdate({
        target: [accounts.providerId, accounts.accountId],
        set: { password: passwordHash },
      });

    await db
      .insert(profiles)
      .values({ userId: row.id, displayName: u.name, headline: u.headline, isSeed: true })
      .onConflictDoUpdate({ target: profiles.userId, set: { headline: u.headline, isSeed: true } });
  }

  for (const s of SEED_SETTINGS) {
    await db.insert(platformSettings).values(s).onConflictDoNothing();
  }
  return { users: SEED_USERS.length, settings: SEED_SETTINGS.length };
}

if (require.main === module) {
  if (process.env.NODE_ENV === 'production') {
    console.error('✗ Refusing to seed: NODE_ENV=production');
    process.exit(1);
  }
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }
  const { db, pool } = createDb(url, { max: 1 });
  seed(db)
    .then((r) => {
      console.warn(`✓ seeded ${r.users} dev users (password: ${SEED_PASSWORD}) and ${r.settings} settings`);
    })
    .catch((err: unknown) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(() => void pool.end());
}
