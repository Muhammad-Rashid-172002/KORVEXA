'use client';
/* eslint-disable @next/next/no-img-element -- local blob / presigned URLs */
import {
  DESCRIPTION_TEMPLATE,
  PACKAGE_TIERS,
  gigQuality,
  gigTemplate,
  type GigHelperResult,
  type ServiceDetailView,
} from '@glasswork/shared';
import { Alert } from '@glasswork/ui/components/alert';
import { Button } from '@glasswork/ui/components/button';
import { Card, CardTitle } from '@glasswork/ui/components/card';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleAlert,
  ImagePlus,
  Plus,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Field } from '@/components/field';
import { HelpTip } from '@/components/help-tip';
import { topLevel } from '@/components/service-cover';
import { TextareaField } from '@/components/textarea-field';
import { gw, uploadFile } from '@/lib/gw';
import { GigPreview } from './gig-preview';
import { ImageCropper } from './image-cropper';

export type Category = { id: string; slug: string; name: string; parentId: string | null };
type Tier = (typeof PACKAGE_TIERS)[number];
type Pkg = { title: string; description: string; price: string; days: string; revisions: string };
type Image = { fileId: string; url: string | null };
type Draft = {
  serviceId: string | null;
  title: string;
  categoryId: string;
  subId: string;
  tags: string[];
  single: boolean;
  packages: Record<Tier, Pkg>;
  extras: { title: string; price: string; days: string }[];
  description: string;
  faqs: { question: string; answer: string }[];
  requirements: { label: string; type: 'text' | 'longtext' | 'file'; required: boolean }[];
  images: Image[];
};

const STEPS = [
  { key: 'overview', label: 'Overview', hint: 'Title and category' },
  { key: 'pricing', label: 'Pricing', hint: 'Packages and prices' },
  { key: 'description', label: 'Description', hint: 'What you offer, and FAQ' },
  { key: 'requirements', label: 'Requirements', hint: 'What you need from buyers' },
  { key: 'gallery', label: 'Gallery', hint: 'Your images' },
  { key: 'publish', label: 'Publish', hint: 'Check and submit' },
] as const;

const emptyPkg = (): Pkg => ({ title: '', description: '', price: '', days: '', revisions: '1' });

function initialDraft(categories: Category[], s?: ServiceDetailView): Draft {
  const packages = { basic: emptyPkg(), standard: emptyPkg(), premium: emptyPkg() };
  for (const p of s?.packages ?? []) {
    packages[p.tier] = {
      title: p.title,
      description: p.description,
      price: String(p.priceAmount / 100),
      days: String(p.deliveryDays),
      revisions: String(p.revisions),
    };
  }
  const cat = s ? categories.find((c) => c.slug === s.category.slug) : undefined;
  return {
    serviceId: s?.id ?? null,
    title: s?.title ?? '',
    categoryId: cat ? (cat.parentId ?? cat.id) : '',
    subId: cat?.parentId ? cat.id : '',
    tags: s?.tags ?? [],
    single: s ? s.packages.length === 1 : false,
    packages,
    extras: (s?.extras ?? []).map((e) => ({
      title: e.title,
      price: String(e.priceAmount / 100),
      days: String(e.extraDays),
    })),
    description: s?.description ?? '',
    faqs: (s?.faqs ?? []).map((f) => ({ question: f.question, answer: f.answer })),
    requirements: (s?.requirementsForm ?? []).map((r) => ({
      label: r.label,
      type: r.type,
      required: r.required,
    })),
    images: (s?.images ?? []).map((i) => ({ fileId: i.fileId, url: i.url })),
  };
}

type Errors = Record<string, string>;

/** Plain-language checks per step. An empty object means the step is fine. */
function validate(step: (typeof STEPS)[number]['key'], d: Draft): Errors {
  const e: Errors = {};
  if (step === 'overview') {
    const t = d.title.trim();
    if (t.length < 10)
      e.title = 'Write a title of at least 10 characters. Start with “I will” and say what you offer.';
    else if (t.length > 100) e.title = 'Please keep your title under 100 characters.';
    if (!d.categoryId) e.category = 'Choose the category where buyers will find you.';
  }
  if (step === 'pricing') {
    const tiers = d.single ? (['basic'] as const) : PACKAGE_TIERS;
    for (const t of tiers) {
      const p = d.packages[t];
      if (p.title.trim().length < 2) e[`${t}-title`] = 'Give this package a short name.';
      if (p.description.trim().length < 10)
        e[`${t}-desc`] = 'Describe what is included (at least 10 characters).';
      if (!(Number(p.price) >= 5)) e[`${t}-price`] = 'The lowest price is $5.';
      if (!(Number(p.days) >= 1 && Number(p.days) <= 180)) e[`${t}-days`] = 'Choose 1 to 180 days.';
      if (!(Number(p.revisions) >= 0 && Number(p.revisions) <= 20)) e[`${t}-rev`] = 'Choose 0 to 20.';
    }
    d.extras.forEach((x, i) => {
      if (x.title.trim().length < 2) e[`extra-${i}-t`] = 'Name this extra.';
      if (!(Number(x.price) >= 1)) e[`extra-${i}-p`] = 'The lowest price is $1.';
    });
  }
  if (step === 'description') {
    const n = d.description.trim().length;
    if (n < 50) e.description = `Write at least 50 characters so buyers know what to expect (${n} so far).`;
    if (n > 5000) e.description = 'Please keep the description under 5,000 characters.';
    d.faqs.forEach((f, i) => {
      if (f.question.trim().length < 3) e[`faq-${i}-q`] = 'Write the question, or remove this one.';
      if (f.answer.trim().length < 3) e[`faq-${i}-a`] = 'Write the answer, or remove this one.';
    });
  }
  if (step === 'requirements') {
    d.requirements.forEach((r, i) => {
      if (r.label.trim().length < 2) e[`req-${i}`] = 'Write the question, or remove it.';
    });
  }
  return e;
}

const allValid = (d: Draft) =>
  (['overview', 'pricing', 'description', 'requirements'] as const).every(
    (k) => Object.keys(validate(k, d)).length === 0,
  );

function toInput(d: Draft) {
  const tiers = d.single ? (['basic'] as const) : PACKAGE_TIERS;
  return {
    categoryId: d.subId || d.categoryId,
    title: d.title.trim(),
    description: d.description.trim(),
    tags: d.tags,
    requirementsForm: d.requirements.filter((r) => r.label.trim()),
    packages: tiers.map((tier) => ({
      tier,
      title: d.packages[tier].title.trim(),
      description: d.packages[tier].description.trim(),
      priceAmount: Math.round(Number(d.packages[tier].price) * 100),
      deliveryDays: Number(d.packages[tier].days),
      revisions: Number(d.packages[tier].revisions),
    })),
    extras: d.extras.map((x) => ({
      title: x.title.trim(),
      priceAmount: Math.round(Number(x.price) * 100),
      extraDays: Number(x.days || 0),
    })),
    faqs: d.faqs,
    imageFileIds: d.images.map((i) => i.fileId),
  };
}

function ErrorText({ id, msg }: { id: string; msg?: string }) {
  if (!msg) return null;
  return (
    <p id={`${id}-err`} role="alert" className="flex items-start gap-1.5 text-xs text-danger">
      <CircleAlert size={13} className="mt-0.5 shrink-0" aria-hidden /> {msg}
    </p>
  );
}

/** A suggestion from the AI helper that the seller reviews before it touches their draft. */
function Suggestion({
  children,
  onUse,
  onDismiss,
}: {
  children: React.ReactNode;
  onUse: () => void;
  onDismiss: () => void;
}) {
  return (
    <div
      className="flex flex-col gap-3 rounded-lg border border-primary/40 bg-primary/5 p-3"
      data-testid="ai-suggestion"
    >
      <p className="flex items-center gap-1.5 text-xs font-medium text-primary">
        <Sparkles size={13} aria-hidden /> Suggestion. You can edit it after you use it.
      </p>
      <div className="whitespace-pre-line text-sm">{children}</div>
      <div className="flex gap-2">
        <Button type="button" size="sm" onClick={onUse}>
          Use this
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDismiss}>
          No thanks
        </Button>
      </div>
    </div>
  );
}

export function GigWizard({
  categories,
  service,
  sellerName,
}: {
  categories: Category[];
  service?: ServiceDetailView;
  sellerName: string;
}) {
  const router = useRouter();
  const storageKey = `gw-gig-draft:${service?.id ?? 'new'}`;
  const [d, setD] = useState<Draft>(() => initialDraft(categories, service));
  const [step, setStep] = useState(0);
  const [reached, setReached] = useState(0);
  const [errors, setErrors] = useState<Errors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'server' | 'local'>('idle');
  const [busy, setBusy] = useState(false);
  const [restored, setRestored] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [suggestion, setSuggestion] = useState<{ kind: string; res: GigHelperResult } | null>(null);
  const [aiBusy, setAiBusy] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [queue, setQueue] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const hydrated = useRef(false);

  const live = service?.status === 'live' || service?.status === 'pending_review';
  const subs = useMemo(
    () => categories.filter((c) => c.parentId === d.categoryId),
    [categories, d.categoryId],
  );
  const parents = useMemo(() => categories.filter((c) => !c.parentId), [categories]);
  const parentCat = categories.find((c) => c.id === d.categoryId);
  const topSlug = topLevel(parentCat?.slug ?? 'web-development');
  const tpl = gigTemplate(topSlug);

  // Restore an unsaved draft from this device (new gigs only; existing gigs load from the server).
  useEffect(() => {
    if (!service) {
      try {
        const raw = localStorage.getItem(storageKey);
        if (raw) {
          const saved = JSON.parse(raw) as { d: Draft; step: number };
          if (saved?.d && typeof saved.d.title === 'string') {
            setD({ ...initialDraft(categories), ...saved.d, images: saved.d.images ?? [] });
            setStep(Math.min(saved.step ?? 0, STEPS.length - 1));
            setReached(Math.min(saved.step ?? 0, STEPS.length - 1));
            setRestored(true);
          }
        }
      } catch {
        /* private mode or bad JSON: start fresh */
      }
    }
    hydrated.current = true;
  }, [categories, service, storageKey]);

  const patch = useCallback((p: Partial<Draft>) => setD((x) => ({ ...x, ...p })), []);
  const setPkg = (tier: Tier, p: Partial<Pkg>) =>
    setD((x) => ({ ...x, packages: { ...x.packages, [tier]: { ...x.packages[tier], ...p } } }));

  /** Writes the draft to the server (create or update). Only valid drafts can be stored there. */
  // One save at a time, and the id of the server draft is remembered the moment it exists: otherwise an autosave
  // still in flight and the final submit could both CREATE, leaving the seller with two copies of the same gig.
  const serviceIdRef = useRef<string | null>(service?.id ?? null);
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const saveToServer = useCallback(
    (draft: Draft): Promise<{ ok: true; id: string } | { ok: false; error: string }> => {
      const run = async (): Promise<{ ok: true; id: string } | { ok: false; error: string }> => {
        const body = toInput(draft);
        const id = serviceIdRef.current;
        const r = id
          ? await gw<ServiceDetailView>('PUT', `/me/services/${id}`, body)
          : await gw<ServiceDetailView>('POST', '/me/services', body);
        if (!r.ok)
          return { ok: false, error: r.error ?? 'We could not save your service. Please try again.' };
        serviceIdRef.current = r.data!.id;
        return { ok: true, id: r.data!.id };
      };
      const next = chain.current.then(run, run);
      chain.current = next.catch(() => undefined);
      return next;
    },
    [],
  );

  // Autosave: always on this device; to the server too once the first four steps are complete (never for a live gig,
  // because saving a live gig sends it back to review).
  const latest = useRef(d);
  latest.current = d;
  useEffect(() => {
    if (!hydrated.current) return;
    const t = setTimeout(async () => {
      try {
        localStorage.setItem(storageKey, JSON.stringify({ d, step }));
      } catch {
        /* ignore */
      }
      if (live || !allValid(d)) {
        setSaveState('local');
        return;
      }
      setSaveState('saving');
      const r = await saveToServer(d);
      if (r.ok) {
        setSaveState('server');
        if (!latest.current.serviceId) setD((x) => (x.serviceId ? x : { ...x, serviceId: r.id }));
      } else setSaveState('local');
    }, 900);
    return () => clearTimeout(t);
  }, [d, step, live, storageKey, saveToServer]);

  const quality = gigQuality({
    title: d.title,
    categoryId: d.categoryId,
    description: d.description,
    packageCount: d.single ? 1 : 3,
    imageCount: d.images.length,
    faqCount: d.faqs.filter((f) => f.question.trim() && f.answer.trim()).length,
    requirementCount: d.requirements.filter((r) => r.label.trim()).length,
    tagCount: d.tags.length,
  });

  const tiers = d.single ? (['basic'] as const) : PACKAGE_TIERS;
  const prices = tiers.map((t) => Number(d.packages[t].price)).filter((n) => n > 0);
  const days = tiers.map((t) => Number(d.packages[t].days)).filter((n) => n > 0);

  function next() {
    const key = STEPS[step]!.key;
    const e = validate(key, d);
    setErrors(e);
    if (Object.keys(e).length) {
      requestAnimationFrame(() =>
        document.querySelector<HTMLElement>('[role="alert"]')?.scrollIntoView({ block: 'center' }),
      );
      return;
    }
    const n = Math.min(step + 1, STEPS.length - 1);
    setStep(n);
    setReached((r) => Math.max(r, n));
    window.scrollTo({ top: 0 });
  }
  function goTo(i: number) {
    if (i <= reached || i < step) {
      setErrors({});
      setStep(i);
    }
  }

  async function ai(kind: 'title' | 'description' | 'packages' | 'faqs') {
    setAiBusy(kind);
    setAiError(null);
    setSuggestion(null);
    const r = await gw<GigHelperResult>('POST', '/ai/gig-helper', {
      kind,
      categorySlug: topSlug,
      title: d.title,
      description: d.description,
    });
    setAiBusy(null);
    if (!r.ok) return setAiError(r.error);
    setSuggestion({ kind, res: r.data! });
  }

  function useSuggestion() {
    if (!suggestion) return;
    const { kind, res } = suggestion;
    if (kind === 'title' && res.title) patch({ title: res.title });
    if (kind === 'description' && res.description) patch({ description: res.description });
    if (kind === 'packages' && res.packages.length) {
      const packages = { ...d.packages };
      for (const p of res.packages) {
        packages[p.tier] = {
          title: p.title,
          description: p.description,
          price: String(Math.round(p.price)),
          days: String(Math.round(p.days)),
          revisions: String(Math.round(p.revisions)),
        };
      }
      patch({ packages });
    }
    if (kind === 'faqs' && res.faqs.length) patch({ faqs: [...d.faqs, ...res.faqs].slice(0, 10) });
    setSuggestion(null);
  }

  const aiButton = (kind: 'title' | 'description' | 'packages' | 'faqs', children: string) => {
    return (
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={aiBusy !== null}
        onClick={() => void ai(kind)}
        data-testid={`ai-${kind}`}
      >
        <Sparkles size={14} aria-hidden /> {aiBusy === kind ? 'Thinking…' : children}
      </Button>
    );
  };

  function addTag(raw: string) {
    const t = raw
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9 +#.-]/g, '');
    if (t.length >= 2 && t.length <= 30 && d.tags.length < 5 && !d.tags.includes(t))
      patch({ tags: [...d.tags, t] });
    setTagInput('');
  }

  // ---- images ----
  function addFiles(list: FileList | File[]) {
    const files = [...list].filter((f) => /^image\/(png|jpeg|webp)$/.test(f.type));
    if (!files.length) {
      setUploadError('Please choose a PNG, JPG or WebP image.');
      return;
    }
    setUploadError(null);
    setQueue((q) => [...q, ...files].slice(0, 6 - d.images.length));
  }
  async function onCropped(blob: Blob) {
    setQueue((q) => q.slice(1));
    setUploading(true);
    setUploadError(null);
    try {
      const id = await uploadFile(new File([blob], 'cover.jpg', { type: 'image/jpeg' }), 'portfolio');
      setD((x) => ({
        ...x,
        images: [...x.images, { fileId: id, url: URL.createObjectURL(blob) }].slice(0, 6),
      }));
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'The upload did not work. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  async function finish(submit: boolean) {
    setSubmitError(null);
    for (const k of ['overview', 'pricing', 'description', 'requirements'] as const) {
      const e = validate(k, d);
      if (Object.keys(e).length) {
        setErrors(e);
        setStep(STEPS.findIndex((s) => s.key === k));
        return;
      }
    }
    setBusy(true);
    const saved = await saveToServer(d);
    if (!saved.ok) {
      setBusy(false);
      return setSubmitError(saved.error);
    }
    if (submit && !live) {
      const r = await gw('POST', `/me/services/${saved.id}/submit`);
      if (!r.ok) {
        setBusy(false);
        return setSubmitError(r.error);
      }
    }
    try {
      localStorage.removeItem(storageKey);
    } catch {
      /* ignore */
    }
    router.push(submit ? `/sell/services?submitted=${saved.id}` : '/sell/services');
    router.refresh();
  }

  const cur = STEPS[step]!;
  const preview = {
    title: d.title,
    categorySlug: topSlug,
    sellerName,
    coverUrl: d.images[0]?.url ?? null,
    fromPrice: prices.length ? Math.min(...prices) : null,
    minDays: days.length ? Math.min(...days) : null,
    description: d.description,
    packages: tiers.map((t) => ({
      tier: t,
      title: d.packages[t].title,
      price: Number(d.packages[t].price) || null,
      days: Number(d.packages[t].days) || null,
    })),
    faqCount: d.faqs.length,
    imageCount: d.images.length,
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="flex min-w-0 flex-col gap-5">
        {/* Stepper */}
        <nav aria-label="Steps" data-testid="wizard-steps">
          <ol className="flex gap-1 overflow-x-auto pb-1">
            {STEPS.map((s, i) => {
              const done = i < reached || i < step;
              return (
                <li key={s.key} className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => goTo(i)}
                    aria-current={i === step ? 'step' : undefined}
                    disabled={i > reached && i > step}
                    className={`flex w-full min-w-[4.5rem] cursor-pointer flex-col items-start gap-1 rounded-lg border px-2.5 py-2 text-left text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                      i === step ? 'border-primary bg-primary/10' : 'border-border hover:bg-surface-2'
                    }`}
                  >
                    <span
                      className={`flex size-5 items-center justify-center rounded-full text-[11px] ${
                        done
                          ? 'bg-success text-bg'
                          : i === step
                            ? 'bg-primary text-bg'
                            : 'bg-surface-2 text-muted'
                      }`}
                    >
                      {done ? <Check size={12} aria-hidden /> : i + 1}
                    </span>
                    <span className="font-medium">{s.label}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        <div
          className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted"
          aria-live="polite"
        >
          <span>
            Step {step + 1} of {STEPS.length}: {cur.hint}
          </span>
          <span data-testid="save-state">
            {saveState === 'saving' && 'Saving…'}
            {saveState === 'server' && '✓ Draft saved'}
            {saveState === 'local' && (live ? 'Changes are saved when you finish' : '✓ Saved on this device')}
          </span>
        </div>

        {restored && (
          <Alert>
            We restored your unfinished draft from this device.{' '}
            <button
              type="button"
              className="underline"
              onClick={() => {
                try {
                  localStorage.removeItem(storageKey);
                } catch {
                  /* ignore */
                }
                setD(initialDraft(categories));
                setStep(0);
                setReached(0);
                setRestored(false);
              }}
            >
              Start over
            </button>
          </Alert>
        )}
        {service?.status === 'rejected' && service.rejectionReason && (
          <Alert tone="warning">Rejected: {service.rejectionReason}. Fix this, then submit again.</Alert>
        )}
        {live && (
          <Alert>
            This service is online. Saving changes sends it back for review and hides it until it is approved
            again.
          </Alert>
        )}
        {aiError && <Alert tone="warning">{aiError}</Alert>}

        {/* ---- 1. Overview ---- */}
        {cur.key === 'overview' && (
          <Card className="flex flex-col gap-4">
            <CardTitle>Describe your service</CardTitle>
            <div className="flex flex-col gap-1.5">
              <Field
                id="title"
                label="Gig title"
                value={d.title}
                onChange={(e) => patch({ title: e.target.value })}
                maxLength={100}
                aria-invalid={!!errors.title}
                placeholder="I will build a Flutter app for your business"
                hint={`${d.title.trim().length}/100. Start with “I will” and say what the buyer gets.`}
              />
              <ErrorText id="title" msg={errors.title} />
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                <span>Examples:</span>
                {tpl.titleExamples.map((ex) => (
                  <button
                    key={ex}
                    type="button"
                    onClick={() => patch({ title: ex })}
                    className="cursor-pointer rounded-full border border-border px-2.5 py-1 text-left hover:border-primary hover:text-fg"
                  >
                    {ex}
                  </button>
                ))}
              </div>
              <div className="mt-1">{aiButton('title', 'Improve my title')}</div>
              {suggestion?.kind === 'title' && suggestion.res.title && (
                <Suggestion onUse={useSuggestion} onDismiss={() => setSuggestion(null)}>
                  {suggestion.res.title}
                </Suggestion>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="categoryId" className="text-sm font-medium">
                  Category
                </label>
                <select
                  id="categoryId"
                  value={d.categoryId}
                  aria-invalid={!!errors.category}
                  onChange={(e) => patch({ categoryId: e.target.value, subId: '' })}
                  className="h-10 rounded-md border border-border bg-surface px-3 text-sm"
                >
                  <option value="" disabled>
                    Choose a category…
                  </option>
                  {parents.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <ErrorText id="category" msg={errors.category} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="subId" className="text-sm font-medium">
                  More specific <span className="font-normal text-muted">(optional)</span>
                </label>
                <select
                  id="subId"
                  value={d.subId}
                  disabled={!subs.length}
                  onChange={(e) => patch({ subId: e.target.value })}
                  className="h-10 rounded-md border border-border bg-surface px-3 text-sm disabled:opacity-50"
                >
                  <option value="">{subs.length ? 'Choose…' : 'Pick a category first'}</option>
                  {subs.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="tag-input" className="text-sm font-medium">
                Search tags <span className="font-normal text-muted">(up to 5)</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {d.tags.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-2 px-2.5 py-1 text-xs"
                  >
                    {t}
                    <button
                      type="button"
                      aria-label={`Remove tag ${t}`}
                      className="cursor-pointer text-muted hover:text-fg"
                      onClick={() => patch({ tags: d.tags.filter((x) => x !== t) })}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <input
                id="tag-input"
                value={tagInput}
                disabled={d.tags.length >= 5}
                onChange={(e) => {
                  if (e.target.value.endsWith(',')) addTag(e.target.value.slice(0, -1));
                  else setTagInput(e.target.value);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addTag(tagInput);
                  }
                }}
                onBlur={() => tagInput && addTag(tagInput)}
                placeholder="Type a word and press Enter, e.g. flutter"
                className="h-10 rounded-md border border-border bg-surface px-3 text-sm"
              />
              {parentCat && d.tags.length === 0 && (
                <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
                  Ideas:
                  {tpl.tags.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => addTag(t)}
                      className="cursor-pointer rounded-full border border-border px-2 py-0.5 hover:border-primary hover:text-fg"
                    >
                      {t}
                    </button>
                  ))}
                </p>
              )}
            </div>
          </Card>
        )}

        {/* ---- 2. Pricing ---- */}
        {cur.key === 'pricing' && (
          <div className="flex flex-col gap-4">
            <Card className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle>
                  Packages{' '}
                  <HelpTip label="packages">
                    Packages let buyers choose how much they want. Most buyers pick the middle one, so make it
                    your best value.
                  </HelpTip>
                </CardTitle>
                <div className="flex flex-wrap gap-2">
                  {aiButton('packages', 'Suggest packages and prices')}
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={d.single}
                  onChange={(e) => patch({ single: e.target.checked })}
                />
                I only want to offer one package
              </label>
              {suggestion?.kind === 'packages' && (
                <Suggestion onUse={useSuggestion} onDismiss={() => setSuggestion(null)}>
                  {suggestion.res.packages
                    .map((p) => `${p.tier}: ${p.title}, $${Math.round(p.price)}, ${Math.round(p.days)} days`)
                    .join('\n')}
                </Suggestion>
              )}
              {!d.single && tiers.every((t) => !d.packages[t].title) && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="self-start"
                  onClick={() => {
                    const packages = { ...d.packages };
                    for (const t of PACKAGE_TIERS) {
                      const p = tpl.packages[t];
                      packages[t] = {
                        title: p.title,
                        description: p.description,
                        price: String(p.price),
                        days: String(p.days),
                        revisions: String(p.revisions),
                      };
                    }
                    patch({ packages });
                  }}
                >
                  Fill with typical examples for this category
                </Button>
              )}
              <div className={`grid gap-3 ${d.single ? '' : 'md:grid-cols-3'}`}>
                {tiers.map((tier) => {
                  const p = d.packages[tier];
                  return (
                    <fieldset
                      key={tier}
                      className={`flex flex-col gap-3 rounded-xl border p-3 ${
                        tier === 'standard' ? 'border-primary/60' : 'border-border'
                      }`}
                    >
                      <legend className="px-1 text-sm font-semibold capitalize">{tier}</legend>
                      <div className="flex flex-col gap-1">
                        <Field
                          id={`${tier}-title`}
                          label="Name"
                          value={p.title}
                          onChange={(e) => setPkg(tier, { title: e.target.value })}
                          maxLength={60}
                          placeholder={tpl.packages[tier].title}
                        />
                        <ErrorText id={`${tier}-title`} msg={errors[`${tier}-title`]} />
                      </div>
                      <div className="flex flex-col gap-1">
                        <TextareaField
                          id={`${tier}-desc`}
                          label="What is included"
                          rows={4}
                          value={p.description}
                          onChange={(e) => setPkg(tier, { description: e.target.value })}
                          maxLength={1000}
                        />
                        <ErrorText id={`${tier}-desc`} msg={errors[`${tier}-desc`]} />
                      </div>
                      <div className="flex flex-col gap-1">
                        <Field
                          id={`${tier}-price`}
                          label="Price (USD)"
                          type="number"
                          min={5}
                          step="1"
                          value={p.price}
                          onChange={(e) => setPkg(tier, { price: e.target.value })}
                        />
                        <ErrorText id={`${tier}-price`} msg={errors[`${tier}-price`]} />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex flex-col gap-1">
                          <Field
                            id={`${tier}-days`}
                            label="Delivery (days)"
                            type="number"
                            min={1}
                            max={180}
                            value={p.days}
                            onChange={(e) => setPkg(tier, { days: e.target.value })}
                          />
                          <ErrorText id={`${tier}-days`} msg={errors[`${tier}-days`]} />
                        </div>
                        <div className="flex flex-col gap-1">
                          <Field
                            id={`${tier}-rev`}
                            label="Changes"
                            type="number"
                            min={0}
                            max={20}
                            value={p.revisions}
                            onChange={(e) => setPkg(tier, { revisions: e.target.value })}
                          />
                          <ErrorText id={`${tier}-rev`} msg={errors[`${tier}-rev`]} />
                        </div>
                      </div>
                    </fieldset>
                  );
                })}
              </div>
              <p className="text-xs text-muted">
                “Changes” is how many times the buyer can ask you to adjust the work. You are paid for each
                step after the buyer approves it.
              </p>
            </Card>

            <Card className="flex flex-col gap-3">
              <CardTitle>
                Extras <span className="text-sm font-normal text-muted">(optional)</span>
              </CardTitle>
              <p className="text-sm text-muted">
                Add-ons buyers can pick, like “Extra revision” or “Fast delivery”.
              </p>
              {d.extras.map((x, i) => (
                <div key={i} className="grid items-start gap-2 sm:grid-cols-[1fr_7rem_6rem_auto]">
                  <div className="flex flex-col gap-1">
                    <Field
                      id={`extra-${i}-t`}
                      label="Extra"
                      value={x.title}
                      onChange={(e) =>
                        patch({
                          extras: d.extras.map((y, j) => (j === i ? { ...y, title: e.target.value } : y)),
                        })
                      }
                    />
                    <ErrorText id={`extra-${i}-t`} msg={errors[`extra-${i}-t`]} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Field
                      id={`extra-${i}-p`}
                      label="Price (USD)"
                      type="number"
                      min={1}
                      value={x.price}
                      onChange={(e) =>
                        patch({
                          extras: d.extras.map((y, j) => (j === i ? { ...y, price: e.target.value } : y)),
                        })
                      }
                    />
                    <ErrorText id={`extra-${i}-p`} msg={errors[`extra-${i}-p`]} />
                  </div>
                  <Field
                    id={`extra-${i}-d`}
                    label="+ Days"
                    type="number"
                    min={0}
                    value={x.days}
                    onChange={(e) =>
                      patch({
                        extras: d.extras.map((y, j) => (j === i ? { ...y, days: e.target.value } : y)),
                      })
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    className="mt-6"
                    aria-label={`Remove extra ${i + 1}`}
                    onClick={() => patch({ extras: d.extras.filter((_, j) => j !== i) })}
                  >
                    <Trash2 size={15} aria-hidden />
                  </Button>
                </div>
              ))}
              {d.extras.length < 10 && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="self-start"
                  onClick={() => patch({ extras: [...d.extras, { title: '', price: '', days: '0' }] })}
                >
                  <Plus size={14} aria-hidden /> Add an extra
                </Button>
              )}
            </Card>
          </div>
        )}

        {/* ---- 3. Description & FAQ ---- */}
        {cur.key === 'description' && (
          <div className="flex flex-col gap-4">
            <Card className="flex flex-col gap-3">
              <CardTitle>Description</CardTitle>
              <p className="text-sm text-muted">
                Explain what buyers get, how you work, and why they should choose you. Plain words work best.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    patch({ description: d.description.trim() ? d.description : DESCRIPTION_TEMPLATE })
                  }
                >
                  Use the guided template
                </Button>
                {aiButton('description', 'Write my description')}
              </div>
              {suggestion?.kind === 'description' && suggestion.res.description && (
                <Suggestion onUse={useSuggestion} onDismiss={() => setSuggestion(null)}>
                  {suggestion.res.description}
                </Suggestion>
              )}
              <div className="flex flex-col gap-1">
                <TextareaField
                  id="description"
                  label="Your description"
                  rows={12}
                  value={d.description}
                  onChange={(e) => patch({ description: e.target.value })}
                  maxLength={5000}
                />
                <p className="text-xs text-muted">{d.description.trim().length}/5000 characters</p>
                <ErrorText id="description" msg={errors.description} />
              </div>
            </Card>

            <Card className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle>
                  Frequently asked questions{' '}
                  <span className="text-sm font-normal text-muted">(recommended)</span>
                </CardTitle>
                {aiButton('faqs', 'Suggest FAQs')}
              </div>
              {suggestion?.kind === 'faqs' && (
                <Suggestion onUse={useSuggestion} onDismiss={() => setSuggestion(null)}>
                  {suggestion.res.faqs.map((f) => `${f.question}\n${f.answer}`).join('\n\n')}
                </Suggestion>
              )}
              {d.faqs.map((q, i) => (
                <div key={i} className="flex flex-col gap-2 rounded-lg border border-border p-3">
                  <Field
                    id={`faq-${i}-q`}
                    label="Question"
                    value={q.question}
                    onChange={(e) =>
                      patch({
                        faqs: d.faqs.map((y, j) => (j === i ? { ...y, question: e.target.value } : y)),
                      })
                    }
                  />
                  <ErrorText id={`faq-${i}-q`} msg={errors[`faq-${i}-q`]} />
                  <TextareaField
                    id={`faq-${i}-a`}
                    label="Answer"
                    rows={2}
                    value={q.answer}
                    onChange={(e) =>
                      patch({ faqs: d.faqs.map((y, j) => (j === i ? { ...y, answer: e.target.value } : y)) })
                    }
                  />
                  <ErrorText id={`faq-${i}-a`} msg={errors[`faq-${i}-a`]} />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="self-start"
                    onClick={() => patch({ faqs: d.faqs.filter((_, j) => j !== i) })}
                  >
                    <Trash2 size={14} aria-hidden /> Remove
                  </Button>
                </div>
              ))}
              {d.faqs.length < 10 && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="self-start"
                  onClick={() => patch({ faqs: [...d.faqs, { question: '', answer: '' }] })}
                >
                  <Plus size={14} aria-hidden /> Add a question
                </Button>
              )}
            </Card>
          </div>
        )}

        {/* ---- 4. Requirements ---- */}
        {cur.key === 'requirements' && (
          <Card className="flex flex-col gap-3">
            <CardTitle>What do you need from the buyer?</CardTitle>
            <p className="text-sm text-muted">
              After a buyer orders, they answer these questions. Good questions mean fewer messages back and
              forth and a faster start.
            </p>
            {tpl.requirements.some((r) => !d.requirements.some((x) => x.label === r)) && (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium text-muted">Ready-made questions. Tap to add:</p>
                <div className="flex flex-wrap gap-2">
                  {tpl.requirements
                    .filter((r) => !d.requirements.some((x) => x.label === r))
                    .map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() =>
                          d.requirements.length < 10 &&
                          patch({
                            requirements: [...d.requirements, { label: r, type: 'longtext', required: true }],
                          })
                        }
                        className="cursor-pointer rounded-full border border-border px-3 py-1.5 text-left text-xs hover:border-primary"
                      >
                        <Plus size={12} className="mr-1 inline" aria-hidden />
                        {r}
                      </button>
                    ))}
                </div>
              </div>
            )}
            {d.requirements.map((r, i) => (
              <div key={i} className="grid items-start gap-2 sm:grid-cols-[1fr_auto_auto]">
                <div className="flex flex-col gap-1">
                  <Field
                    id={`req-${i}`}
                    label={`Question ${i + 1}`}
                    value={r.label}
                    onChange={(e) =>
                      patch({
                        requirements: d.requirements.map((y, j) =>
                          j === i ? { ...y, label: e.target.value } : y,
                        ),
                      })
                    }
                  />
                  <ErrorText id={`req-${i}`} msg={errors[`req-${i}`]} />
                </div>
                <label className="flex items-center gap-2 text-sm sm:mt-8">
                  <input
                    type="checkbox"
                    checked={r.required}
                    onChange={(e) =>
                      patch({
                        requirements: d.requirements.map((y, j) =>
                          j === i ? { ...y, required: e.target.checked } : y,
                        ),
                      })
                    }
                  />
                  Required
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  className="sm:mt-6"
                  aria-label={`Remove question ${i + 1}`}
                  onClick={() => patch({ requirements: d.requirements.filter((_, j) => j !== i) })}
                >
                  <Trash2 size={15} aria-hidden />
                </Button>
              </div>
            ))}
            {d.requirements.length < 10 && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="self-start"
                onClick={() =>
                  patch({
                    requirements: [...d.requirements, { label: '', type: 'longtext', required: true }],
                  })
                }
              >
                <Plus size={14} aria-hidden /> Add your own question
              </Button>
            )}
          </Card>
        )}

        {/* ---- 5. Gallery ---- */}
        {cur.key === 'gallery' && (
          <Card className="flex flex-col gap-4">
            <CardTitle>Show your work</CardTitle>
            <p className="text-sm text-muted" data-testid="image-count">
              {d.images.length} of 6 images. Your first image is the cover buyers see in search results.
            </p>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                addFiles(e.dataTransfer.files);
              }}
              className={`flex flex-col items-center gap-3 rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
                dragging ? 'border-primary bg-primary/10' : 'border-border'
              }`}
            >
              <Upload size={28} className="text-primary" aria-hidden />
              <p className="text-sm font-medium">Drag and drop images here</p>
              <p className="text-xs text-muted">or</p>
              <Button
                type="button"
                disabled={d.images.length >= 6 || uploading}
                onClick={() => fileInput.current?.click()}
              >
                <ImagePlus size={16} aria-hidden /> {uploading ? 'Uploading…' : 'Choose images'}
              </Button>
              <input
                ref={fileInput}
                type="file"
                multiple
                aria-label="Add a gallery image"
                accept="image/png,image/jpeg,image/webp"
                data-testid="gallery-input"
                className="sr-only"
                disabled={d.images.length >= 6}
                onChange={(e) => {
                  if (e.target.files) addFiles(e.target.files);
                  e.target.value = '';
                }}
              />
              <p className="text-xs text-muted">
                PNG, JPG or WebP · best size 1280 × 720 (wide) · we crop to this shape for you · up to 10 MB
                each
              </p>
            </div>
            {uploadError && <Alert tone="danger">{uploadError}</Alert>}
            {d.images.length > 0 && (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3" data-testid="gallery-list">
                {d.images.map((im, i) => (
                  <li key={im.fileId} className="relative overflow-hidden rounded-lg border border-border">
                    {im.url ? (
                      <img
                        src={im.url}
                        alt={`Gallery image ${i + 1}`}
                        className="aspect-video w-full object-cover"
                      />
                    ) : (
                      <div className="flex aspect-video items-center justify-center bg-surface-2 text-xs text-muted">
                        Image {i + 1}
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-1 p-1.5 text-xs">
                      {i === 0 ? (
                        <span className="rounded-full bg-primary/15 px-2 py-0.5 text-primary">Cover</span>
                      ) : (
                        <button
                          type="button"
                          className="cursor-pointer underline"
                          onClick={() => patch({ images: [im, ...d.images.filter((x) => x !== im)] })}
                        >
                          Make cover
                        </button>
                      )}
                      <button
                        type="button"
                        aria-label={`Remove image ${i + 1}`}
                        className="cursor-pointer text-muted hover:text-danger"
                        onClick={() => patch({ images: d.images.filter((x) => x !== im) })}
                      >
                        <Trash2 size={14} aria-hidden />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className="rounded-lg bg-surface-2 p-4 text-sm">
              <p className="font-medium">What makes a good cover?</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
                <li>Show a real result: a screen of an app you built, a finished design, a dashboard.</li>
                <li>Keep it simple. Big, clear, and easy to understand in one second.</li>
                <li>Use your own work only. Do not use pictures you do not have the right to use.</li>
              </ul>
              {d.images.length === 0 && (
                <p className="mt-3 text-muted">
                  No image yet? We will make a clean cover with your title and name (the preview on the
                  right). Real images still get far more clicks, so add one when you can.
                </p>
              )}
            </div>
          </Card>
        )}

        {/* ---- 6. Publish ---- */}
        {cur.key === 'publish' && (
          <Card className="flex flex-col gap-4" data-testid="publish-step">
            <CardTitle>Ready to publish?</CardTitle>
            <div className="flex items-center gap-4">
              <div
                className="flex size-20 shrink-0 items-center justify-center rounded-full border-4 text-xl font-semibold"
                style={{
                  borderColor: quality.score >= 80 ? 'var(--color-success)' : 'var(--color-warning)',
                }}
                data-testid="quality-score"
              >
                {quality.score}
              </div>
              <p className="text-sm text-muted">
                Quality score out of 100.{' '}
                {quality.score >= 80
                  ? 'Great. Your gig looks complete.'
                  : 'You can publish now, but fixing the items below will get you more orders.'}
              </p>
            </div>
            <ul className="flex flex-col gap-2">
              {quality.checks.map((c) => (
                <li key={c.key} className="flex items-start gap-2 text-sm">
                  {c.ok ? (
                    <Check size={16} className="mt-0.5 shrink-0 text-success" aria-hidden />
                  ) : (
                    <CircleAlert size={16} className="mt-0.5 shrink-0 text-warning" aria-hidden />
                  )}
                  <span>
                    <span className="font-medium">{c.label}</span>
                    {!c.ok && <span className="text-muted"> — {c.tip}</span>}
                  </span>
                </li>
              ))}
            </ul>
            <p className="rounded-lg bg-surface-2 p-3 text-sm text-muted">
              {live
                ? 'Saving sends your service back to our team for a quick check, usually within a day.'
                : 'Our team checks every new service (usually within a day) before it goes online. You can still edit afterwards.'}
            </p>
            {submitError && (
              <Alert tone="danger" data-testid="submit-error">
                {submitError}{' '}
                {/profile/i.test(submitError) && (
                  <Link className="underline" href="/seller/onboarding">
                    Finish my seller profile
                  </Link>
                )}
              </Alert>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={busy}
                onClick={() => void finish(true)}
                data-testid="submit-gig"
              >
                {busy ? 'Saving…' : live ? 'Save changes' : 'Submit for review'}
              </Button>
              {!live && (
                <Button type="button" variant="secondary" disabled={busy} onClick={() => void finish(false)}>
                  Save as draft
                </Button>
              )}
            </div>
          </Card>
        )}

        {/* Nav */}
        <div className="flex items-center justify-between gap-3">
          <Button type="button" variant="ghost" disabled={step === 0} onClick={() => goTo(step - 1)}>
            <ArrowLeft size={16} aria-hidden /> Back
          </Button>
          {step < STEPS.length - 1 && (
            <Button type="button" onClick={next} data-testid="wizard-next">
              Save &amp; continue <ArrowRight size={16} aria-hidden />
            </Button>
          )}
        </div>

        <details className="rounded-xl border border-border p-3 lg:hidden">
          <summary className="cursor-pointer text-sm font-medium">See how buyers will see this</summary>
          <div className="mt-3">
            <GigPreview d={preview} />
          </div>
        </details>
      </div>

      <aside className="hidden lg:block">
        <div className="sticky top-20">
          <GigPreview d={preview} />
        </div>
      </aside>

      <ImageCropper
        file={queue[0] ?? null}
        onCancel={() => setQueue((q) => q.slice(1))}
        onDone={(b) => void onCropped(b)}
      />
    </div>
  );
}
