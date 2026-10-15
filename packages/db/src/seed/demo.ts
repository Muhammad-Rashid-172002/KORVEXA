/**
 * Realistic DEVELOPMENT demo data (Phase 8): a believable marketplace for screenshots and design work.
 *   pnpm db:seed        -> minimal dev personas (used by tests and e2e)
 *   pnpm db:seed:demo   -> adds the demo catalogue on top (never used by tests)
 * Refuses to run in production. Every row has is_seed=true; services show a "Demo" badge in the UI; seed rows are
 * excluded from seller analytics (D-027). Re-running is a no-op (use `pnpm dev:reset` for a clean slate).
 */
import { eq, sql } from 'drizzle-orm';
import { createDb, type Database } from '../client';
import { hashPassword } from '../password';
import {
  accounts,
  briefs,
  categories,
  milestones,
  profiles,
  projects,
  reviews,
  sellerProfiles,
  sellerSkills,
  serviceExtras,
  serviceFaqs,
  servicePackages,
  services,
  skills,
  users,
  verifications,
} from '../schema';
import { DEMO_BUYERS, DEMO_REVIEW_TEXTS, DEMO_SELLERS } from './demo-data';
import { SEED_PASSWORD } from './index';

const DEMO_DOMAIN = '@demo.glasswork.test';
const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);
const isoDate = (d: Date) => d.toISOString().slice(0, 10);

const OPEN_REQUESTS = [
  {
    buyer: 0,
    title: 'Booking and membership app for a yoga studio',
    description:
      'We run 3 studios and manage classes in spreadsheets. We need a mobile-friendly web app where members book classes, manage memberships and get reminders, plus an admin view for staff. Stripe payments for memberships.',
    min: 400000,
    max: 900000,
  },
  {
    buyer: 1,
    title: 'Driver check-in dashboard with live map',
    description:
      'A web dashboard for dispatchers showing drivers on a map with status updates from our existing REST API. Needs role-based access and an audit trail of status changes.',
    min: 250000,
    max: 600000,
  },
  {
    buyer: 2,
    title: 'Patient intake forms with e-signature',
    description:
      'Replace paper intake with secure digital forms, e-signature and a staff review queue. Must follow health-data good practice; we will share requirements under NDA.',
    min: 300000,
    max: 700000,
  },
  {
    buyer: 3,
    title: 'Landing page and waitlist for a developer tool',
    description:
      'Fast, accessible marketing site with a waitlist, email capture and basic analytics. Design is ready in Figma.',
    min: 80000,
    max: 200000,
  },
  {
    buyer: 4,
    title: 'Add usage-based billing to our SaaS',
    description:
      'We have Stripe subscriptions today and need metered usage billing with invoices, a usage dashboard for customers, and proper handling of failed payments.',
    min: 500000,
    max: 1200000,
  },
  {
    buyer: 5,
    title: 'Security review before our public launch',
    description:
      'Fintech API and web app, Node and Postgres. We want an independent review with a prioritised fix list and a retest. Staging environment available.',
    min: 300000,
    max: 800000,
  },
];

/** Demo data is created once. Re-seeding after real activity (projects, payments) would hit FK restrictions, so a
 *  second run is a no-op; use `pnpm dev:reset` for a clean slate. */
async function alreadySeeded(db: Database): Promise<boolean> {
  const r = await db.execute<{ n: number }>(
    sql`select count(*)::int as n from users where email like ${'%' + DEMO_DOMAIN}`,
  );
  return (r.rows[0]?.n ?? 0) > 0;
}

export async function seedDemo(
  db: Database,
): Promise<{ sellers: number; services: number; reviews: number }> {
  const passwordHash = await hashPassword(SEED_PASSWORD);
  if (await alreadySeeded(db)) return { sellers: 0, services: 0, reviews: 0 };

  const cats = new Map(
    (await db.select({ id: categories.id, slug: categories.slug }).from(categories)).map((c) => [
      c.slug,
      c.id,
    ]),
  );
  const skillIds = new Map<string, string>();
  const ensureSkill = async (name: string) => {
    const slug = slugify(name);
    if (!skillIds.has(slug)) {
      await db.insert(skills).values({ slug, name, isSeed: true }).onConflictDoNothing();
      const [sk] = await db.select({ id: skills.id }).from(skills).where(eq(skills.slug, slug));
      if (!sk) throw new Error(`skill ${slug}`);
      skillIds.set(slug, sk.id);
    }
    return skillIds.get(slug)!;
  };

  const makeUser = async (email: string, name: string, roles: ('buyer' | 'seller')[]) => {
    const [u] = await db
      .insert(users)
      .values({
        email,
        name,
        emailVerified: true,
        roles,
        activeMode: roles.includes('seller') ? 'seller' : 'buyer',
        isSeed: true,
      })
      .returning({ id: users.id });
    if (!u) throw new Error('user');
    await db
      .insert(accounts)
      .values({ userId: u.id, providerId: 'credential', accountId: u.id, password: passwordHash });
    return u.id;
  };

  const buyerIds: string[] = [];
  for (const b of DEMO_BUYERS) {
    const id = await makeUser(b.email, b.name, ['buyer']);
    await db.insert(profiles).values({ userId: id, displayName: b.name, headline: b.headline, isSeed: true });
    buyerIds.push(id);
  }

  let serviceCount = 0;
  let reviewCount = 0;
  let sellerIdx = 0;
  for (const s of DEMO_SELLERS) {
    const id = await makeUser(s.email, s.name, ['buyer', 'seller']);
    await db.insert(profiles).values({
      userId: id,
      displayName: s.name,
      slug: s.slug,
      headline: s.headline,
      bio: s.bio,
      country: s.country,
      timezone: s.timezone,
      languages: s.languages,
      isSeed: true,
    });
    await db.insert(sellerProfiles).values({
      userId: id,
      availability: s.availability,
      hourlyRateAmount: s.rateUsd * 100,
      yearsExperience: s.years,
      onboardingCompletedAt: daysAgo(200),
      isSeed: true,
    });
    for (const name of s.skills) {
      await db
        .insert(sellerSkills)
        .values({ sellerId: id, skillId: await ensureSkill(name) })
        .onConflictDoNothing();
    }
    for (const kind of s.verified) {
      await db.insert(verifications).values({
        userId: id,
        kind,
        status: 'verified',
        evidence: { note: 'Demo verification' },
        reviewedAt: daysAgo(150),
      });
    }

    const serviceIds: { id: string; price: number }[] = [];
    for (const [i, svc] of s.services.entries()) {
      const categoryId = cats.get(svc.category);
      if (!categoryId) throw new Error(`unknown category ${svc.category}`);
      const [row] = await db
        .insert(services)
        .values({
          sellerId: id,
          categoryId,
          slug: svc.slug,
          title: svc.title,
          description: svc.description,
          status: 'live',
          publishedAt: daysAgo(120 - sellerIdx * 7 - i * 3),
          isSeed: true,
        })
        .returning({ id: services.id });
      if (!row) throw new Error('service');
      const tiers = ['basic', 'standard', 'premium'] as const;
      for (const [t, p] of svc.packages.entries()) {
        await db.insert(servicePackages).values({
          serviceId: row.id,
          tier: tiers[t]!,
          title: p[0],
          description: p[1],
          priceAmount: p[2] * 100,
          deliveryDays: p[3],
          revisions: p[4],
        });
      }
      for (const [o, e] of svc.extras.entries()) {
        await db
          .insert(serviceExtras)
          .values({ serviceId: row.id, title: e[0], priceAmount: e[1] * 100, extraDays: e[2], sortOrder: o });
      }
      for (const [o, f] of svc.faqs.entries()) {
        await db
          .insert(serviceFaqs)
          .values({ serviceId: row.id, question: f[0], answer: f[1], sortOrder: o });
      }
      serviceIds.push({ id: row.id, price: svc.packages[1][2] * 100 });
      serviceCount++;
    }

    // Completed, reviewed projects so ratings, levels and "completed projects" are real rows (not hand-typed numbers).
    for (const [r, rv] of s.reviews.entries()) {
      const buyerId = buyerIds[(r + sellerIdx) % buyerIds.length]!;
      const svc = serviceIds[r % serviceIds.length]!;
      const total = svc.price;
      const start = 20 + r * 24 + sellerIdx * 3;
      const [proj] = await db
        .insert(projects)
        .values({
          buyerId,
          sellerId: id,
          serviceId: svc.id,
          title: s.services[r % s.services.length]!.title,
          status: 'reviewed',
          totalAmount: total,
          startedAt: daysAgo(start + 30),
          completedAt: daysAgo(start),
          isSeed: true,
        })
        .returning({ id: projects.id });
      if (!proj) throw new Error('project');
      const split = [0.3, 0.4, 0.3].map((f) => Math.round(total * f));
      split[2] = total - split[0]! - split[1]!;
      let lastMilestone: string | null = null;
      for (const [m, label] of ['Discovery and plan', 'Build', 'Polish and handover'].entries()) {
        const due = daysAgo(start + 30 - (m + 1) * 10);
        const [ms] = await db
          .insert(milestones)
          .values({
            projectId: proj.id,
            position: m + 1,
            title: label,
            amount: split[m]!,
            status: 'released',
            plannedStart: isoDate(daysAgo(start + 30 - m * 10)),
            plannedDue: isoDate(due),
            actualSubmittedAt: rv[3] >= 4 || m < 2 ? due : new Date(due.getTime() + 2 * 86_400_000),
            approvedAt: due,
          })
          .returning({ id: milestones.id });
        lastMilestone = ms?.id ?? null;
      }
      void lastMilestone;
      await db.insert(reviews).values({
        projectId: proj.id,
        authorId: buyerId,
        subjectSellerId: id,
        visibility: 'public',
        ratingOverall: rv[0],
        ratingCommunication: rv[1],
        ratingQuality: rv[2],
        ratingTimeliness: rv[3],
        body: DEMO_REVIEW_TEXTS[(r + sellerIdx * 3) % DEMO_REVIEW_TEXTS.length]!,
        isSeed: true,
        createdAt: daysAgo(start - 1),
      });
      reviewCount++;
    }
    sellerIdx++;
  }

  for (const r of OPEN_REQUESTS) {
    await db.insert(briefs).values({
      buyerId: buyerIds[r.buyer]!,
      title: r.title,
      description: r.description,
      budgetMinAmount: r.min,
      budgetMaxAmount: r.max,
      status: 'open',
      isSeed: true,
    });
  }
  return { sellers: DEMO_SELLERS.length, services: serviceCount, reviews: reviewCount };
}

if (require.main === module) {
  if (process.env.NODE_ENV === 'production') {
    console.error('✗ Refusing to seed demo data: NODE_ENV=production');
    process.exit(1);
  }
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }
  const { db, pool } = createDb(url, { max: 1 });
  seedDemo(db)
    .then((r) =>
      console.warn(
        `✓ demo data: ${r.sellers} sellers, ${r.services} services, ${r.reviews} reviews (password: ${SEED_PASSWORD})`,
      ),
    )
    .catch((err: unknown) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(() => void pool.end());
}
