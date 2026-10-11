'use client';
import type { OnboardingStatus, ProfileView } from '@glasswork/shared';
import { Alert } from '@glasswork/ui/components/alert';
import { Badge } from '@glasswork/ui/components/badge';
import { Button } from '@glasswork/ui/components/button';
import { Card, CardTitle } from '@glasswork/ui/components/card';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Field } from '@/components/field';
import { TextareaField } from '@/components/textarea-field';
import { gw } from '@/lib/gw';

const LABELS: Record<keyof OnboardingStatus['steps'], string> = {
  profile: 'Profile',
  skills: 'Skills',
  portfolio: 'Portfolio',
  rates: 'Rates',
  payout: 'Payout method',
  identity: 'Identity verification',
};

export function Wizard({ profile, status }: { profile: ProfileView; status: OnboardingStatus }) {
  const router = useRouter();
  const seller = profile.seller!;
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const [pending, setPending] = useState(false);

  async function save(fn: () => Promise<{ ok: boolean; error: string | null }>, ok = 'Saved.') {
    setPending(true);
    const r = await fn();
    setPending(false);
    setMsg(r.ok ? { tone: 'success', text: ok } : { tone: 'danger', text: r.error ?? 'Failed' });
    if (r.ok) router.refresh();
  }
  const text = (f: FormData, k: string) => String(f.get(k) ?? '').trim();

  const onProfile = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    void save(() =>
      gw('PATCH', '/me/profile', {
        headline: text(f, 'headline') || null,
        bio: text(f, 'bio') || null,
        country: text(f, 'country').toUpperCase() || null,
      }),
    );
  };
  const onSkills = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const names = text(new FormData(e.currentTarget), 'skills')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    void save(() => gw('PUT', '/me/seller/skills', { skills: names }));
  };
  const onRates = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const rate = Number(text(f, 'rate'));
    const years = text(f, 'years');
    void save(() =>
      gw('PATCH', '/me/seller', {
        hourlyRateAmount: Number.isFinite(rate) && text(f, 'rate') !== '' ? Math.round(rate * 100) : null,
        yearsExperience: years === '' ? null : Number(years),
      }),
    );
  };
  const onPortfolio = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    void save(async () => {
      const r = await gw('POST', '/me/seller/portfolio', {
        title: text(f, 'title'),
        url: text(f, 'url') || null,
        description: text(f, 'description') || null,
      });
      if (r.ok) form.reset();
      return r;
    }, 'Portfolio item added.');
  };
  const onPayout = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    void save(() =>
      gw('PATCH', '/me/seller', { payoutPreference: text(new FormData(e.currentTarget), 'payout') || null }),
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <ol className="flex flex-wrap gap-2" aria-label="Onboarding progress">
        {(Object.keys(LABELS) as (keyof typeof LABELS)[]).map((k) => (
          <li key={k}>
            <Badge className={status.steps[k] ? 'border-primary/40 text-primary' : ''}>
              {status.steps[k] ? '✓ ' : ''}
              {LABELS[k]}
              {status.required.includes(k as 'profile') ? ' *' : ''}
            </Badge>
          </li>
        ))}
      </ol>
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}

      <Card className="flex flex-col gap-3">
        <CardTitle>1. Profile *</CardTitle>
        <form className="flex flex-col gap-3" onSubmit={onProfile}>
          <Field id="headline" label="Headline" defaultValue={profile.headline ?? ''} maxLength={120} />
          <TextareaField id="bio" label="About you" defaultValue={profile.bio ?? ''} />
          <Field
            id="country"
            label="Country (2-letter code)"
            defaultValue={profile.country ?? ''}
            maxLength={2}
          />
          <Button type="submit" disabled={pending} className="self-start">
            Save
          </Button>
        </form>
      </Card>

      <Card className="flex flex-col gap-3">
        <CardTitle>2. Skills *</CardTitle>
        <form className="flex flex-col gap-3" onSubmit={onSkills}>
          <Field
            id="skills"
            label="Skills, comma separated"
            defaultValue={seller.skills.map((s) => s.name).join(', ')}
            hint="e.g. React, Node.js, Flutter"
          />
          <Button type="submit" disabled={pending} className="self-start">
            Save
          </Button>
        </form>
      </Card>

      <Card className="flex flex-col gap-3">
        <CardTitle>3. Portfolio</CardTitle>
        <ul className="flex flex-col gap-1 text-sm">
          {seller.portfolio.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3">
              <span className="truncate">{p.title}</span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => void save(() => gw('DELETE', `/me/seller/portfolio/${p.id}`), 'Removed.')}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
        <form className="flex flex-col gap-3" onSubmit={onPortfolio}>
          <Field id="title" label="Project title" required maxLength={120} />
          <Field id="url" label="Link (https://…)" type="url" />
          <TextareaField id="description" label="Short description" rows={2} maxLength={1000} />
          <Button type="submit" variant="secondary" disabled={pending} className="self-start">
            Add item
          </Button>
        </form>
      </Card>

      <Card className="flex flex-col gap-3">
        <CardTitle>4. Rates *</CardTitle>
        <form className="flex flex-col gap-3" onSubmit={onRates}>
          <Field
            id="rate"
            label={`Hourly rate (${seller.rateCurrency})`}
            type="number"
            min={0}
            step="0.01"
            defaultValue={seller.hourlyRateAmount === null ? '' : String(seller.hourlyRateAmount / 100)}
          />
          <Field
            id="years"
            label="Years of experience"
            type="number"
            min={0}
            max={60}
            defaultValue={seller.yearsExperience ?? ''}
          />
          <Button type="submit" disabled={pending} className="self-start">
            Save
          </Button>
        </form>
      </Card>

      <Card className="flex flex-col gap-3">
        <CardTitle>5. Payout method (placeholder)</CardTitle>
        <p className="text-sm text-muted">
          Tell us how you would like to be paid. No account details are collected yet; the payout rail depends
          on the platform&apos;s legal setup.
        </p>
        <form className="flex flex-col gap-3" onSubmit={onPayout}>
          <Field
            id="payout"
            label="Preference"
            defaultValue={seller.payoutPreference ?? ''}
            maxLength={200}
          />
          <Button type="submit" variant="secondary" disabled={pending} className="self-start">
            Save
          </Button>
        </form>
      </Card>

      <Card className="flex flex-col gap-2">
        <CardTitle>6. Identity verification (placeholder)</CardTitle>
        <p className="text-sm text-muted">Identity checks and verified badges arrive in a later release.</p>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          disabled={pending || !status.complete}
          onClick={() =>
            void save(() => gw('POST', '/me/seller/onboarding/complete'), 'Your seller profile is published.')
          }
        >
          {seller.onboardingCompleted ? 'Republish' : 'Publish seller profile'}
        </Button>
        {!status.complete && <span className="text-sm text-muted">Complete the steps marked * first.</span>}
        {profile.slug && seller.onboardingCompleted && (
          <Link
            className="text-sm text-primary underline-offset-4 hover:underline"
            href={`/u/${profile.slug}`}
          >
            View public profile →
          </Link>
        )}
      </div>
    </div>
  );
}
