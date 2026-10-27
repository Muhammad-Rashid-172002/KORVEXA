'use client';
import { PACKAGE_TIERS, type ServiceDetailView } from '@glasswork/shared';
import { Alert } from '@glasswork/ui/components/alert';
import { Button } from '@glasswork/ui/components/button';
import { Card, CardTitle } from '@glasswork/ui/components/card';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Field } from '@/components/field';
import { TextareaField } from '@/components/textarea-field';
import { gw, uploadFile } from '@/lib/gw';

type Category = { id: string; name: string };
type Pkg = {
  enabled: boolean;
  title: string;
  description: string;
  price: string;
  days: string;
  revisions: string;
};

const emptyPkg = (): Pkg => ({
  enabled: false,
  title: '',
  description: '',
  price: '',
  days: '',
  revisions: '1',
});

function initialPackages(s?: ServiceDetailView): Record<(typeof PACKAGE_TIERS)[number], Pkg> {
  const out = { basic: emptyPkg(), standard: emptyPkg(), premium: emptyPkg() };
  out.basic.enabled = true;
  for (const p of s?.packages ?? []) {
    out[p.tier] = {
      enabled: true,
      title: p.title,
      description: p.description,
      price: String(p.priceAmount / 100),
      days: String(p.deliveryDays),
      revisions: String(p.revisions),
    };
  }
  return out;
}

export function ServiceForm({
  categories,
  service,
}: {
  categories: Category[];
  service?: ServiceDetailView;
}) {
  const router = useRouter();
  const [packages, setPackages] = useState(() => initialPackages(service));
  const [extras, setExtras] = useState(() =>
    (service?.extras ?? []).map((e) => ({
      title: e.title,
      price: String(e.priceAmount / 100),
      days: String(e.extraDays),
    })),
  );
  const [faqs, setFaqs] = useState(() =>
    (service?.faqs ?? []).map((f) => ({ question: f.question, answer: f.answer })),
  );
  const [requirements, setRequirements] = useState(() =>
    (service?.requirementsForm ?? []).map((r) => ({ label: r.label, type: r.type, required: r.required })),
  );
  const [imageIds, setImageIds] = useState<string[]>(() => (service?.images ?? []).map((i) => i.fileId));
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const setPkg = (tier: keyof typeof packages, patch: Partial<Pkg>) =>
    setPackages((p) => ({ ...p, [tier]: { ...p[tier], ...patch } }));

  async function onImage(file: File) {
    try {
      const id = await uploadFile(file, 'portfolio');
      setImageIds((ids) => [...ids, id].slice(0, 6));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    }
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body = {
      categoryId: String(f.get('categoryId')),
      title: String(f.get('title')).trim(),
      description: String(f.get('description')).trim(),
      requirementsForm: requirements.filter((r) => r.label.trim()),
      packages: PACKAGE_TIERS.filter((t) => packages[t].enabled).map((tier) => ({
        tier,
        title: packages[tier].title.trim(),
        description: packages[tier].description.trim(),
        priceAmount: Math.round(Number(packages[tier].price) * 100),
        deliveryDays: Number(packages[tier].days),
        revisions: Number(packages[tier].revisions),
      })),
      extras: extras.map((x) => ({
        title: x.title.trim(),
        priceAmount: Math.round(Number(x.price) * 100),
        extraDays: Number(x.days || 0),
      })),
      faqs,
      imageFileIds: imageIds,
    };
    setPending(true);
    setError(null);
    const r = service
      ? await gw<ServiceDetailView>('PUT', `/me/services/${service.id}`, body)
      : await gw<ServiceDetailView>('POST', '/me/services', body);
    setPending(false);
    if (!r.ok) return setError(r.error);
    router.push('/sell/services');
    router.refresh();
  }

  return (
    <form className="flex flex-col gap-6" onSubmit={onSubmit}>
      {service?.status === 'rejected' && service.rejectionReason && (
        <Alert tone="warning">Rejected: {service.rejectionReason}</Alert>
      )}
      {service?.status === 'live' && (
        <Alert>
          Saving changes to a live service sends it back for review and hides it until it is approved again.
        </Alert>
      )}
      <Card className="flex flex-col gap-3">
        <CardTitle>Overview</CardTitle>
        <Field
          id="title"
          label="Title"
          defaultValue={service?.title}
          required
          minLength={10}
          maxLength={100}
          hint="10–100 characters, e.g. “I will build your React web app”."
        />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="categoryId" className="text-sm font-medium">
            Category
          </label>
          <select
            id="categoryId"
            name="categoryId"
            required
            defaultValue={categories.find((c) => c.name === service?.category.name)?.id ?? ''}
            className="h-10 rounded-md border border-border bg-surface px-3 text-sm"
          >
            <option value="" disabled>
              Choose…
            </option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <TextareaField
          id="description"
          label="Description"
          defaultValue={service?.description}
          required
          minLength={50}
          maxLength={5000}
          rows={8}
        />
      </Card>

      {PACKAGE_TIERS.map((tier) => {
        const p = packages[tier];
        return (
          <Card key={tier} className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <CardTitle className="capitalize">{tier} package</CardTitle>
              {tier !== 'basic' && (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={p.enabled}
                    onChange={(e) => setPkg(tier, { enabled: e.target.checked })}
                  />
                  Offer this tier
                </label>
              )}
            </div>
            {p.enabled && (
              <>
                <Field
                  id={`${tier}-title`}
                  label="Name"
                  value={p.title}
                  onChange={(e) => setPkg(tier, { title: e.target.value })}
                  required
                  minLength={2}
                  maxLength={60}
                />
                <TextareaField
                  id={`${tier}-desc`}
                  label="What is included"
                  value={p.description}
                  onChange={(e) => setPkg(tier, { description: e.target.value })}
                  required
                  minLength={10}
                  maxLength={1000}
                  rows={3}
                />
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field
                    id={`${tier}-price`}
                    label="Price (USD)"
                    type="number"
                    min={5}
                    step="0.01"
                    value={p.price}
                    onChange={(e) => setPkg(tier, { price: e.target.value })}
                    required
                  />
                  <Field
                    id={`${tier}-days`}
                    label="Delivery (days)"
                    type="number"
                    min={1}
                    max={180}
                    value={p.days}
                    onChange={(e) => setPkg(tier, { days: e.target.value })}
                    required
                  />
                  <Field
                    id={`${tier}-rev`}
                    label="Revisions"
                    type="number"
                    min={0}
                    max={20}
                    value={p.revisions}
                    onChange={(e) => setPkg(tier, { revisions: e.target.value })}
                    required
                  />
                </div>
              </>
            )}
          </Card>
        );
      })}

      <Card className="flex flex-col gap-3">
        <CardTitle>Extras</CardTitle>
        {extras.map((x, i) => (
          <div key={i} className="grid items-end gap-2 sm:grid-cols-[1fr_7rem_6rem_auto]">
            <Field
              id={`extra-${i}-t`}
              label="Title"
              value={x.title}
              onChange={(e) =>
                setExtras((a) => a.map((y, j) => (j === i ? { ...y, title: e.target.value } : y)))
              }
              required
            />
            <Field
              id={`extra-${i}-p`}
              label="Price (USD)"
              type="number"
              min={1}
              step="0.01"
              value={x.price}
              onChange={(e) =>
                setExtras((a) => a.map((y, j) => (j === i ? { ...y, price: e.target.value } : y)))
              }
              required
            />
            <Field
              id={`extra-${i}-d`}
              label="+Days"
              type="number"
              min={0}
              value={x.days}
              onChange={(e) =>
                setExtras((a) => a.map((y, j) => (j === i ? { ...y, days: e.target.value } : y)))
              }
            />
            <Button
              type="button"
              variant="ghost"
              onClick={() => setExtras((a) => a.filter((_, j) => j !== i))}
            >
              Remove
            </Button>
          </div>
        ))}
        {extras.length < 10 && (
          <Button
            type="button"
            variant="secondary"
            className="self-start"
            onClick={() => setExtras((a) => [...a, { title: '', price: '', days: '0' }])}
          >
            Add extra
          </Button>
        )}
      </Card>

      <Card className="flex flex-col gap-3">
        <CardTitle>Buyer requirements</CardTitle>
        <p className="text-sm text-muted">Questions the buyer answers when ordering.</p>
        {requirements.map((r, i) => (
          <div key={i} className="grid items-end gap-2 sm:grid-cols-[1fr_auto_auto]">
            <Field
              id={`req-${i}`}
              label="Question"
              value={r.label}
              onChange={(e) =>
                setRequirements((a) => a.map((y, j) => (j === i ? { ...y, label: e.target.value } : y)))
              }
              required
            />
            <label className="flex items-center gap-2 pb-2 text-sm">
              <input
                type="checkbox"
                checked={r.required}
                onChange={(e) =>
                  setRequirements((a) =>
                    a.map((y, j) => (j === i ? { ...y, required: e.target.checked } : y)),
                  )
                }
              />
              Required
            </label>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setRequirements((a) => a.filter((_, j) => j !== i))}
            >
              Remove
            </Button>
          </div>
        ))}
        {requirements.length < 10 && (
          <Button
            type="button"
            variant="secondary"
            className="self-start"
            onClick={() =>
              setRequirements((a) => [...a, { label: '', type: 'longtext' as const, required: true }])
            }
          >
            Add question
          </Button>
        )}
      </Card>

      <Card className="flex flex-col gap-3">
        <CardTitle>FAQ</CardTitle>
        {faqs.map((q, i) => (
          <div key={i} className="flex flex-col gap-2 rounded-md border border-border p-3">
            <Field
              id={`faq-${i}-q`}
              label="Question"
              value={q.question}
              onChange={(e) =>
                setFaqs((a) => a.map((y, j) => (j === i ? { ...y, question: e.target.value } : y)))
              }
              required
            />
            <TextareaField
              id={`faq-${i}-a`}
              label="Answer"
              rows={2}
              value={q.answer}
              onChange={(e) =>
                setFaqs((a) => a.map((y, j) => (j === i ? { ...y, answer: e.target.value } : y)))
              }
              required
            />
            <Button
              type="button"
              variant="ghost"
              className="self-start"
              onClick={() => setFaqs((a) => a.filter((_, j) => j !== i))}
            >
              Remove
            </Button>
          </div>
        ))}
        {faqs.length < 10 && (
          <Button
            type="button"
            variant="secondary"
            className="self-start"
            onClick={() => setFaqs((a) => [...a, { question: '', answer: '' }])}
          >
            Add FAQ
          </Button>
        )}
      </Card>

      <Card className="flex flex-col gap-3">
        <CardTitle>Gallery</CardTitle>
        <p className="text-sm text-muted" data-testid="image-count">
          {imageIds.length} of 6 images
        </p>
        <input
          type="file"
          aria-label="Add a gallery image"
          accept="image/png,image/jpeg,image/webp"
          data-testid="gallery-input"
          disabled={imageIds.length >= 6}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void onImage(file);
            e.target.value = '';
          }}
        />
        {imageIds.length > 0 && (
          <Button type="button" variant="ghost" className="self-start" onClick={() => setImageIds([])}>
            Clear images
          </Button>
        )}
      </Card>

      {error && <Alert tone="danger">{error}</Alert>}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? 'Saving…' : service ? 'Save changes' : 'Create draft'}
      </Button>
    </form>
  );
}
