import { SELLER_LEVELS, type ServicePageView } from '@glasswork/shared';
import { Badge } from '@glasswork/ui/components/badge';
import { Button } from '@glasswork/ui/components/button';
import { Section } from '@glasswork/ui/components/section';
import { ArrowRight, FileText, Gavel, ShieldCheck, Sparkles, Users } from 'lucide-react';
import Link from 'next/link';
import { ServiceCard } from '@/components/service-card';
import { publicGw } from '@/lib/public-api';
import { Reveal } from './reveal';

/** Real listings only. Renders nothing until at least three published services exist. */
export async function FeaturedServices() {
  const { data } = await publicGw<ServicePageView>('/services?limit=3&sort=rating');
  if (!data || data.items.length < 3) return null;
  return (
    <Section>
      <Reveal>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-primary">Ready to order</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              Services you can start today
            </h2>
          </div>
          <Button asChild variant="secondary">
            <Link href="/services">
              View all services <ArrowRight size={14} aria-hidden />
            </Link>
          </Button>
        </div>
      </Reveal>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.items.slice(0, 3).map((s) => (
          <li key={s.id}>
            <ServiceCard s={s} showFavorite={false} />
          </li>
        ))}
      </ul>
    </Section>
  );
}

const MATCH_ROWS = [
  ['Skills match', 'React, Next.js, PostgreSQL'],
  ['Budget fit', 'Inside your range'],
  ['Response time', 'Usually replies within hours'],
];

/** AI features surfaced on the home page. The mock-ups are labelled illustrative. */
export function AiSection() {
  return (
    <Section className="bg-surface/40">
      <Reveal>
        <p className="text-xs font-medium uppercase tracking-wider text-primary">
          AI that explains, you decide
        </p>
        <h2 className="mt-2 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
          From a rough idea to a brief, a shortlist and a weekly report
        </h2>
        <p className="mt-3 max-w-2xl text-muted">
          AI helps you write, match and stay informed. It never accepts offers, moves money or makes trust
          decisions.
        </p>
      </Reveal>
      <div className="mt-10 grid gap-4 lg:grid-cols-3">
        <Reveal className="h-full">
          <article className="card-lift flex h-full flex-col rounded-xl border border-border bg-surface p-5">
            <Sparkles size={20} className="text-primary" aria-hidden />
            <h3 className="mt-3 font-medium">AI brief builder</h3>
            <p className="mt-2 text-sm text-muted">
              Describe your idea. Answer a few questions. Get goals, user stories, platforms, integrations and
              suggested milestones, with budget and timeline marked as estimates.
            </p>
            <div
              className="mt-4 rounded-lg border border-border bg-bg p-3 text-xs"
              aria-label="Illustrative brief"
            >
              <p className="font-medium">Booking app · suggested milestones</p>
              <ol className="mt-2 list-decimal space-y-1 pl-4 text-muted">
                <li>Discovery &amp; wireframes</li>
                <li>Core app build</li>
                <li>Payments &amp; launch</li>
              </ol>
              <Badge className="mt-3">Estimate</Badge>
            </div>
            <Button asChild className="mt-auto self-start" size="sm">
              <Link href="/requests/new/ai" className="mt-5">
                Build my brief
              </Link>
            </Button>
          </article>
        </Reveal>
        <Reveal delay={0.06} className="h-full">
          <article className="card-lift flex h-full flex-col rounded-xl border border-border bg-surface p-5">
            <Users size={20} className="text-primary" aria-hidden />
            <h3 className="mt-3 font-medium">AI matching with reasons</h3>
            <p className="mt-2 text-sm text-muted">
              Sellers are ranked on skills, verified portfolio, ratings, response time, availability and
              budget fit, and every match explains why.
            </p>
            <dl
              className="mt-4 space-y-1 rounded-lg border border-border bg-bg p-3 text-xs"
              aria-label="Illustrative match explanation"
            >
              {MATCH_ROWS.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3">
                  <dt className="text-muted">{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
            <Button asChild className="mt-auto self-start" size="sm" variant="secondary">
              <Link href="/match" className="mt-5">
                Find a match
              </Link>
            </Button>
          </article>
        </Reveal>
        <Reveal delay={0.12} className="h-full">
          <article className="card-lift flex h-full flex-col rounded-xl border border-border bg-surface p-5">
            <FileText size={20} className="text-primary" aria-hidden />
            <h3 className="mt-3 font-medium">Weekly progress report</h3>
            <p className="mt-2 text-sm text-muted">
              A plain-English summary of what is done, what is next, risks and decisions needed. Your seller
              reviews and edits it before it reaches you.
            </p>
            <div
              className="mt-4 rounded-lg border border-border bg-bg p-3 text-xs"
              aria-label="Illustrative weekly report"
            >
              <p className="font-medium">This week, in plain English</p>
              <p className="mt-1 text-muted">
                Login and booking screens are built. Next: the calendar sync. One decision needed from you:
                which payment methods to support at launch.
              </p>
            </div>
            <p className="mt-auto pt-5 text-xs text-muted">Illustrative example, not a real project.</p>
          </article>
        </Reveal>
      </div>
    </Section>
  );
}

/** Milestone protection, the dispute centre and transparent levels. */
export function ProtectionSection() {
  return (
    <Section>
      <Reveal>
        <p className="text-xs font-medium uppercase tracking-wider text-primary">Protection built in</p>
        <h2 className="mt-2 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
          Pay for progress, not promises
        </h2>
      </Reveal>
      <div className="mt-10 grid gap-4 lg:grid-cols-3">
        <Reveal className="h-full">
          <article className="card-lift h-full rounded-xl border border-border bg-surface p-5">
            <ShieldCheck size={20} className="text-primary" aria-hidden />
            <h3 className="mt-3 font-medium">Milestone protection at checkout</h3>
            <p className="mt-2 text-sm text-muted">
              You fund one milestone at a time. The money is held in escrow and released only when you approve
              the work, or after the review window and reminders. The full fee breakdown is shown before you
              pay.
            </p>
            <Link href="/pricing" className="mt-3 inline-block text-sm">
              How escrow and fees work
            </Link>
          </article>
        </Reveal>
        <Reveal delay={0.06} className="h-full">
          <article className="card-lift h-full rounded-xl border border-border bg-surface p-5">
            <Gavel size={20} className="text-primary" aria-hidden />
            <h3 className="mt-3 font-medium">Dispute center with a case file</h3>
            <p className="mt-2 text-sm text-muted">
              If something goes wrong, messages, deliverable versions, approvals and the timeline are gathered
              into one case file. Our team decides from evidence, not screenshots.
            </p>
            <Link href="/help/open-a-dispute" className="mt-3 inline-block text-sm">
              How disputes work
            </Link>
          </article>
        </Reveal>
        <Reveal delay={0.12} className="h-full">
          <article className="card-lift h-full rounded-xl border border-border bg-surface p-5">
            <Users size={20} className="text-primary" aria-hidden />
            <h3 className="mt-3 font-medium">Seller levels you can check</h3>
            <p className="mt-2 text-sm text-muted">
              Levels are computed from completed projects, reviews, rating and on-time delivery. The criteria
              are public and cannot be bought.
            </p>
            <ul className="mt-3 flex flex-wrap gap-2 text-xs">
              {SELLER_LEVELS.map((l) => (
                <li key={l.key}>
                  <Badge>{l.label}</Badge>
                </li>
              ))}
            </ul>
            <Link href="/seller-levels" className="mt-3 inline-block text-sm">
              See the criteria
            </Link>
          </article>
        </Reveal>
      </div>
    </Section>
  );
}
