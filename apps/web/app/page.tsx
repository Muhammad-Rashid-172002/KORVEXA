import { brand } from '@glasswork/shared/brand';
import { Button } from '@glasswork/ui/components/button';
import { Section } from '@glasswork/ui/components/section';
import {
  ArrowRight,
  BarChart3,
  Bot,
  FileDiff,
  Gavel,
  GitBranch,
  Handshake,
  LayoutPanelLeft,
  Lock,
  Video,
} from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { HeroVisual } from '@/components/marketing/hero-visual';
import { Reveal } from '@/components/marketing/reveal';
import { RoomPreview } from '@/components/marketing/room-preview';

export const metadata: Metadata = {
  title: { absolute: `${brand.productName} by ${brand.parentName} · ${brand.tagline}` },
  description:
    'A marketplace for software projects. Hire verified builders, fund work milestone by milestone, and see exactly how far your project has progressed.',
  openGraph: { title: brand.lockup, description: brand.tagline, type: 'website' },
};

const STEPS = [
  {
    n: '01',
    title: 'Describe your idea',
    body: 'Use the AI brief builder or pick a ready-made service. Estimates are always labelled as estimates.',
  },
  {
    n: '02',
    title: 'Choose a verified builder',
    body: 'Compare real portfolios, reviews and response times. Badges appear only when actually verified.',
  },
  {
    n: '03',
    title: 'Fund one milestone at a time',
    body: 'Money waits in escrow and moves only when you approve the work, or the review window passes.',
  },
  {
    n: '04',
    title: 'Watch it get built',
    body: 'A live project room shows progress, previews, tasks and every decision, without chasing anyone.',
  },
];

const FEATURES = [
  {
    icon: LayoutPanelLeft,
    title: 'Live project room',
    body: 'Progress weighted by milestone value, health with a reason, timeline, board, versioned deliverables and an activity feed.',
  },
  {
    icon: Lock,
    title: 'Milestone escrow',
    body: 'Every milestone is funded separately and released on approval. A transparent ledger records every cent.',
  },
  {
    icon: Bot,
    title: 'AI that explains, not decides',
    body: 'Brief builder, match explanations and weekly progress summaries your seller edits before sending.',
  },
  {
    icon: FileDiff,
    title: 'Formal change requests',
    body: 'Scope changes carry time and price impact and need acceptance and funding. No surprise invoices.',
  },
  {
    icon: Video,
    title: 'Built-in meetings',
    body: 'Video calls with consent-gated recording. Meeting notes become tasks on the board.',
  },
  {
    icon: GitBranch,
    title: 'Code activity, in plain language',
    body: 'Optionally connect GitHub to see commits, pull requests and deployments summarised for non-engineers.',
  },
  {
    icon: Gavel,
    title: 'Evidence-based disputes',
    body: 'A case file is assembled automatically from messages, versions and approvals. Admins resolve with exact ledger math.',
  },
  {
    icon: BarChart3,
    title: 'Honest seller metrics',
    body: 'Levels and analytics are computed from real data with public criteria. No data means "not enough data yet".',
  },
];

const CATEGORIES = [
  ['web-development', 'Web development'],
  ['mobile-apps', 'Mobile apps'],
  ['ai-ml', 'AI & machine learning'],
  ['saas', 'SaaS & backend'],
  ['design', 'UI/UX design'],
  ['devops', 'DevOps & cloud'],
  ['qa-testing', 'QA & testing'],
  ['data', 'Data & analytics'],
] as const;

const FAQ = [
  [
    'When does the seller get paid?',
    'Only after you approve a milestone, or after the review window passes with no response. Reminders are sent before auto-approval.',
  ],
  [
    'What if the work is not what I asked for?',
    'Request changes on any deliverable, with feedback pinned to the exact spot. If you cannot agree, open a dispute: the evidence is collected for you and our team decides.',
  ],
  [
    'Can I talk to a seller before ordering?',
    'Yes. Message any seller. We warn both sides if payment or contact details are shared off-platform, because that removes your protection.',
  ],
  [
    'Is the AI making decisions?',
    'No. AI drafts briefs, explains matches and summarises progress. Ranking is rule-based from real data, and sellers review summaries before you see them.',
  ],
  [
    'Who runs this?',
    `${brand.productName} is owned and operated by ${brand.parentName}. Services listed by ${brand.parentName}'s own agency are labelled and get no ranking advantage.`,
  ],
];

export default function HomePage() {
  return (
    <>
      <section className="bg-hero-glow relative overflow-hidden px-4 pt-14 sm:pt-24">
        <div className="bg-grid pointer-events-none absolute inset-0 opacity-40" aria-hidden />
        <div className="relative mx-auto max-w-6xl">
          <div className="mx-auto max-w-3xl text-center">
            <p className="glass mx-auto inline-flex rounded-full px-3 py-1 text-xs text-muted">
              Software projects, made visible
            </p>
            <h1 className="mt-5 text-4xl font-semibold leading-[1.1] tracking-tight sm:text-6xl">
              Hire verified builders. <span className="text-gradient">Watch your project move.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base text-muted sm:text-lg">
              {brand.productName} is a marketplace for apps, websites, AI and design work where every
              milestone, deliverable and payment lives in one live project room.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg">
                <Link href="/services">
                  Browse services <ArrowRight size={16} aria-hidden />
                </Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link href="/requests/new/ai">Describe your idea with AI</Link>
              </Button>
            </div>
            <p className="mt-4 text-xs text-muted">
              Escrow on every milestone · Verified badges only when verified
            </p>
          </div>
          <HeroVisual />
        </div>
      </section>

      <Section id="how-it-works">
        <Reveal>
          <p className="text-xs font-medium uppercase tracking-wider text-primary">How it works</p>
          <h2 className="mt-2 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
            From a rough idea to shipped software, with no black box in the middle
          </h2>
        </Reveal>
        <ol className="mt-10 grid gap-4 md:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.n}>
              <Reveal delay={i * 0.07} className="h-full">
                <div className="card-lift h-full rounded-xl border border-border bg-surface p-5">
                  <p className="font-mono text-sm text-primary">{s.n}</p>
                  <h3 className="mt-3 font-medium">{s.title}</h3>
                  <p className="mt-2 text-sm text-muted">{s.body}</p>
                </div>
              </Reveal>
            </li>
          ))}
        </ol>
      </Section>

      <Section className="bg-surface/40">
        <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.35fr]">
          <Reveal>
            <p className="text-xs font-medium uppercase tracking-wider text-primary">The project room</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              Always know what is done, what is next and what you are paying for
            </h2>
            <p className="mt-4 text-muted">
              Progress is calculated from approved milestones and completed tasks, never typed in by hand. If
              something is at risk or blocked, the room says so and says why.
            </p>
            <Button asChild variant="secondary" className="mt-6">
              <Link href="/how-it-works">See how it works</Link>
            </Button>
          </Reveal>
          <Reveal delay={0.1}>
            <RoomPreview />
            <p className="mt-2 text-center text-xs text-muted">Illustrative example, not a real project.</p>
          </Reveal>
        </div>
      </Section>

      <Section>
        <Reveal>
          <p className="text-xs font-medium uppercase tracking-wider text-primary">Built for software</p>
          <h2 className="mt-2 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
            Everything a generic freelance marketplace leaves out
          </h2>
        </Reveal>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={(i % 4) * 0.06} className="h-full">
              <div className="card-lift h-full rounded-xl border border-border bg-surface p-5">
                <f.icon size={20} className="text-primary" aria-hidden />
                <h3 className="mt-3 font-medium">{f.title}</h3>
                <p className="mt-2 text-sm text-muted">{f.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      <Section className="bg-surface/40">
        <Reveal>
          <h2 className="text-3xl font-semibold tracking-tight">Explore by category</h2>
        </Reveal>
        <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
          {CATEGORIES.map(([slug, name]) => (
            <Link
              key={slug}
              href={`/services?category=${slug}`}
              className="card-lift group flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-4 text-sm font-medium"
            >
              {name}
              <ArrowRight
                size={14}
                className="text-muted transition-transform group-hover:translate-x-0.5"
                aria-hidden
              />
            </Link>
          ))}
        </div>
      </Section>

      <Section>
        <div className="glass bg-hero-glow relative overflow-hidden rounded-3xl px-6 py-12 sm:px-12">
          <div className="grid items-center gap-8 md:grid-cols-[1.4fr_1fr]">
            <Reveal>
              <Handshake size={24} className="text-primary" aria-hidden />
              <h2 className="mt-3 text-3xl font-semibold tracking-tight">Build with us as a seller</h2>
              <p className="mt-3 max-w-xl text-muted">
                Get paid for approved milestones, show your real work, and let transparent levels and verified
                badges do the talking. Your reputation is computed from real projects only.
              </p>
            </Reveal>
            <div className="flex flex-wrap gap-3 md:justify-end">
              <Button asChild size="lg">
                <Link href="/for-sellers">Become a seller</Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link href="/seller-levels">How levels work</Link>
              </Button>
            </div>
          </div>
        </div>
      </Section>

      <Section id="faq" className="pt-0">
        <h2 className="text-3xl font-semibold tracking-tight">Questions, answered plainly</h2>
        <div className="mt-8 divide-y divide-border rounded-xl border border-border bg-surface">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group px-5 py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium">
                {q}
                <span className="text-muted transition-transform group-open:rotate-45" aria-hidden>
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm text-muted">{a}</p>
            </details>
          ))}
        </div>
        <div className="mt-12 text-center">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Ready to see your project take shape?
          </h2>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/signup">Create a free account</Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href="/services">Browse services</Link>
            </Button>
          </div>
        </div>
      </Section>
    </>
  );
}
