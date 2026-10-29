import { brand } from '@glasswork/shared/brand';
import { gigTemplate } from '@glasswork/shared';
import { Button } from '@glasswork/ui/components/button';
import { Section } from '@glasswork/ui/components/section';
import {
  ArrowRight,
  BadgeCheck,
  Check,
  Handshake,
  LayoutPanelLeft,
  ListChecks,
  MessageSquareText,
  Sparkles,
  UserSearch,
  Wallet,
  X,
} from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { CategoryArt } from '@/components/category-art';
import { LiveProgressDemo } from '@/components/marketing/live-progress-demo';
import { Reveal } from '@/components/marketing/reveal';
import { FeaturedServices } from '@/components/marketing/home-sections';

export const metadata: Metadata = {
  title: { absolute: `${brand.productName} by ${brand.parentName} · ${brand.tagline}` },
  description:
    'Hire verified experts for apps, websites and AI, and watch your project progress live. Pay step by step, only when you are happy.',
  openGraph: { title: brand.lockup, description: brand.tagline, type: 'website' },
};

const STEPS = [
  {
    icon: MessageSquareText,
    title: 'Describe your project',
    body: 'Tell us what you need in your own words. Our AI helper turns your idea into a clear plan.',
  },
  {
    icon: UserSearch,
    title: 'Pick a verified expert',
    body: 'Compare real work, reviews and prices. Badges only appear when we have checked them.',
  },
  {
    icon: Wallet,
    title: 'Watch it grow, pay step by step',
    body: 'See progress live. Each payment is released only when you approve that step.',
  },
];

const WHY = [
  [
    LayoutPanelLeft,
    'See progress, always',
    'A live page shows what is done, what is next and what is late. No chasing.',
  ],
  [
    Wallet,
    'Pay one step at a time',
    'Your money is held safely and goes to the expert only after you approve each step.',
  ],
  [
    BadgeCheck,
    'Experts we have checked',
    'Identity, portfolio and skills badges are only shown when they are real.',
  ],
  [
    Sparkles,
    'AI help with your brief',
    'Not sure what to ask for? Answer a few questions and get a ready-to-send project brief.',
  ],
] as const;

const COMPARE = [
  ['See how far the work has got', 'Live progress bar, tasks and previews', 'Ask and wait for updates'],
  ['Pay', 'Step by step, after you approve', 'Often everything up front'],
  ['Know who you hire', 'Verified badges, real reviews', 'Mostly self-described'],
  ['Write your project brief', 'AI helps you, free', 'Figure it out yourself'],
  ['Change the plan mid-way', 'Clear price and time shown first', 'Messy chat negotiation'],
];

const CATEGORIES = [
  ['web-development', 'Websites & web apps', 'Business sites, online shops, dashboards'],
  ['mobile-apps', 'Mobile apps', 'iPhone and Android apps'],
  ['ai-ml', 'AI & chatbots', 'Chatbots, automation, AI features'],
  ['saas', 'Software products', 'MVPs, backends and APIs'],
  ['design', 'Design', 'App design, logos, prototypes'],
  ['devops', 'Hosting & cloud', 'Put your app online, keep it fast'],
  ['qa-testing', 'Testing', 'Find bugs before your users do'],
  ['data', 'Data & reports', 'Dashboards and clean data'],
] as const;

const FAQ = [
  [
    'When does the expert get paid?',
    'Only after you approve a step, or after the review time passes with no reply from you. We remind you before that happens.',
  ],
  [
    'What if the work is not what I asked for?',
    'Ask for changes and point at the exact spot. If you still cannot agree, open a case: we collect the messages and files for you and our team decides.',
  ],
  [
    'Can I talk to an expert before ordering?',
    'Yes. Message any expert. Keep payments on the platform: paying outside removes your protection, and we warn you if it comes up.',
  ],
  [
    'Is the AI making decisions?',
    'No. AI helps you write a brief and explains suggestions. You choose, and experts check any AI summary before you see it.',
  ],
  [
    'Who runs this?',
    `${brand.productName} is owned and operated by ${brand.parentName}. Services from ${brand.parentName}'s own team are labelled and get no ranking advantage.`,
  ],
];

export default async function HomePage() {
  return (
    <>
      <section className="bg-hero-glow relative overflow-hidden px-4 pb-16 pt-12 sm:pb-24 sm:pt-20">
        <div className="bg-grid pointer-events-none absolute inset-0 opacity-40" aria-hidden />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.05fr_1fr]">
          <div className="text-center lg:text-left">
            <p className="glass inline-flex rounded-full px-3 py-1 text-xs text-muted">
              For apps, websites, AI and design
            </p>
            <h1 className="mt-5 text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
              Hire verified experts. <span className="text-gradient">Watch your project progress live.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-base text-muted sm:text-lg lg:mx-0">
              Tell us what you want built. Pick a checked expert, follow every step on one page, and pay only
              when you are happy with each step.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3 lg:justify-start">
              <Button asChild size="lg">
                <Link href="/services">
                  Find an expert <ArrowRight size={16} aria-hidden />
                </Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link href="/for-sellers">Start selling</Link>
              </Button>
            </div>
            <ul className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-1 text-xs text-muted lg:justify-start">
              {['Free to join', 'Pay step by step', 'Experts are checked'].map((t) => (
                <li key={t} className="flex items-center gap-1.5">
                  <Check size={14} className="text-success" aria-hidden /> {t}
                </li>
              ))}
            </ul>
          </div>
          <LiveProgressDemo />
        </div>
      </section>

      <Section id="how-it-works">
        <Reveal>
          <p className="text-xs font-medium uppercase tracking-wider text-primary">
            How {brand.productName} works
          </p>
          <h2 className="mt-2 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
            Three simple steps from idea to finished project
          </h2>
        </Reveal>
        <ol className="mt-10 grid gap-4 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title}>
              <Reveal delay={i * 0.07} className="h-full">
                <div className="card-lift relative h-full rounded-xl border border-border bg-surface p-6">
                  <span className="absolute right-5 top-4 font-mono text-4xl font-semibold text-border">
                    {i + 1}
                  </span>
                  <span className="flex size-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
                    <s.icon size={24} aria-hidden />
                  </span>
                  <h3 className="mt-4 text-lg font-medium">{s.title}</h3>
                  <p className="mt-2 text-sm text-muted">{s.body}</p>
                </div>
              </Reveal>
            </li>
          ))}
        </ol>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/requests/new/ai">
              <Sparkles size={16} aria-hidden /> Write my project brief with AI
            </Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/how-it-works">More details</Link>
          </Button>
        </div>
      </Section>

      <Section className="bg-surface/40">
        <Reveal>
          <p className="text-xs font-medium uppercase tracking-wider text-primary">Popular categories</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">What do you need built?</h2>
        </Reveal>
        <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {CATEGORIES.map(([slug, name, examples], i) => (
            <Reveal key={slug} delay={(i % 4) * 0.05} className="h-full">
              <Link
                href={`/services?category=${slug}`}
                className="card-lift group relative flex h-full flex-col overflow-hidden rounded-xl border border-border bg-surface"
              >
                <div
                  className="flex aspect-[4/3] items-center justify-center"
                  style={{
                    background: `linear-gradient(135deg, hsl(${gigTemplate(slug).hue} 55% 10%), hsl(${gigTemplate(slug).hue + 20} 60% 22%))`,
                  }}
                >
                  <CategoryArt
                    slug={slug}
                    accent={`hsl(${gigTemplate(slug).hue + 10} 75% 55%)`}
                    className="size-3/4"
                  />
                </div>
                <div className="flex flex-1 flex-col gap-1 p-3 sm:p-4">
                  <h3 className="flex items-center justify-between text-sm font-medium sm:text-base">
                    {name}
                    <ArrowRight
                      size={14}
                      className="shrink-0 text-muted transition-transform group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </h3>
                  <p className="text-xs text-muted">{examples}</p>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </Section>

      <FeaturedServices />

      <Section>
        <Reveal>
          <p className="text-xs font-medium uppercase tracking-wider text-primary">Why {brand.productName}</p>
          <h2 className="mt-2 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
            Why {brand.productName}, not a regular freelance site?
          </h2>
        </Reveal>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {WHY.map(([Icon, title, body], i) => (
            <Reveal key={title} delay={(i % 4) * 0.06} className="h-full">
              <div className="card-lift h-full rounded-xl border border-border bg-surface p-5">
                <Icon size={22} className="text-primary" aria-hidden />
                <h3 className="mt-3 font-medium">{title}</h3>
                <p className="mt-2 text-sm text-muted">{body}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <div
          className="mt-8 overflow-x-auto rounded-xl border border-border bg-surface"
          role="region"
          aria-label="Comparison table"
          tabIndex={0}
        >
          <table className="w-full min-w-[34rem] text-left text-sm">
            <caption className="sr-only">{brand.productName} compared with a regular freelance site</caption>
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                <th scope="col" className="px-4 py-3 font-medium">
                  <span className="sr-only">Question</span>
                </th>
                <th scope="col" className="px-4 py-3 font-medium text-primary">
                  {brand.productName}
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Regular freelance site
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {COMPARE.map(([what, us, them]) => (
                <tr key={what}>
                  <th scope="row" className="px-4 py-3 font-medium">
                    {what}
                  </th>
                  <td className="px-4 py-3">
                    <Check size={14} className="mr-1.5 inline text-success" aria-hidden />
                    {us}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    <X size={14} className="mr-1.5 inline text-muted" aria-hidden />
                    {them}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section className="bg-surface/40">
        <div className="glass bg-hero-glow relative overflow-hidden rounded-3xl px-6 py-12 sm:px-12">
          <div className="grid items-center gap-8 md:grid-cols-[1.4fr_1fr]">
            <Reveal>
              <Handshake size={24} className="text-primary" aria-hidden />
              <h2 className="mt-3 text-3xl font-semibold tracking-tight">Are you a developer or designer?</h2>
              <p className="mt-3 max-w-xl text-muted">
                Create your first service in minutes with our step-by-step guide. Get paid for every approved
                step, and build a reputation from real projects.
              </p>
            </Reveal>
            <div className="flex flex-wrap gap-3 md:justify-end">
              <Button asChild size="lg">
                <Link href="/for-sellers">Start selling</Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link href="/seller-levels">How levels work</Link>
              </Button>
            </div>
          </div>
        </div>
      </Section>

      <Section id="faq">
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
          <ListChecks size={24} className="mx-auto text-primary" aria-hidden />
          <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
            Ready to get your project started?
          </h2>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/signup">Create a free account</Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href="/services">Find an expert</Link>
            </Button>
          </div>
        </div>
      </Section>
    </>
  );
}
