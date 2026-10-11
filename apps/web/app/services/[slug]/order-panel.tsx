'use client';
import {
  DEFAULT_MILESTONE_TEMPLATE,
  splitByPercent,
  type FeeQuote,
  type ServiceDetailView,
} from '@glasswork/shared';
import { Alert } from '@glasswork/ui/components/alert';
import { Button } from '@glasswork/ui/components/button';
import { Card, CardTitle } from '@glasswork/ui/components/card';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { TextareaField } from '@/components/textarea-field';
import { money } from '@/lib/format';
import { gw, newIdempotencyKey } from '@/lib/gw';

/** Package picker → order → first-milestone checkout. All amounts shown here are previews; the server recomputes them. */
export function OrderPanel({ service }: { service: ServiceDetailView }) {
  const router = useRouter();
  const [tier, setTier] = useState(service.packages[0]!.id);
  const [extraIds, setExtraIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // One key per order attempt: a double-click or retry can never create two projects.
  const orderKey = useRef(newIdempotencyKey());

  const pkg = service.packages.find((p) => p.id === tier)!;
  const extras = service.extras.filter((e) => extraIds.includes(e.id));
  const total = pkg.priceAmount + extras.reduce((s, e) => s + e.priceAmount, 0);
  const days = pkg.deliveryDays + extras.reduce((s, e) => s + e.extraDays, 0);
  const first = splitByPercent(
    total,
    DEFAULT_MILESTONE_TEMPLATE.map((m) => m.percent),
  )[0]!;

  // Exact breakdown from the server's quote endpoint (settings are admin-editable, never hard-coded here).
  const [quote, setQuote] = useState<FeeQuote | null>(null);
  useEffect(() => {
    let live = true;
    void gw<FeeQuote>('GET', `/fees/quote?amount=${first}`).then((r) => live && setQuote(r.data));
    return () => {
      live = false;
    };
  }, [first]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setPending(true);
    setError(null);
    const order = await gw<{ projectId: string; firstMilestoneId: string }>(
      'POST',
      '/orders',
      {
        packageId: tier,
        extraIds,
        answers: service.requirementsForm.map((_, i) => String(f.get(`answer-${i}`) ?? '')),
        notes: String(f.get('notes') ?? '').trim() || undefined,
      },
      { 'idempotency-key': orderKey.current },
    );
    if (order.status === 401) return router.push(`/login?next=/services/${service.slug}`);
    if (!order.data) {
      setPending(false);
      return setError(order.error);
    }
    const fund = await gw<{ checkoutUrl: string | null; paymentId: string }>(
      'POST',
      `/milestones/${order.data.firstMilestoneId}/fund`,
      undefined,
      { 'idempotency-key': newIdempotencyKey() },
    );
    setPending(false);
    if (!fund.data) {
      // The order exists; the buyer can finish paying from the project page.
      return router.push(`/projects/${order.data.projectId}`);
    }
    const url = fund.data.checkoutUrl;
    if (url && /^https?:\/\//.test(url)) window.location.assign(url);
    else router.push(`/projects/${order.data.projectId}`);
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" data-testid="order-panel">
      <fieldset className="flex flex-col gap-3">
        <legend className="sr-only">Choose a package</legend>
        {service.packages.map((p) => (
          <label key={p.id} className="cursor-pointer" data-testid={`package-${p.tier}`}>
            <input
              type="radio"
              name="package"
              className="peer sr-only"
              checked={tier === p.id}
              onChange={() => setTier(p.id)}
            />
            <Card className="flex flex-col gap-2 peer-checked:border-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary">
              <div className="flex items-start justify-between gap-3">
                <CardTitle className="capitalize">
                  {p.tier}: {p.title}
                </CardTitle>
                <span className="text-lg font-semibold tabular-nums">
                  {money(p.priceAmount, service.currency)}
                </span>
              </div>
              <p className="text-sm text-muted">{p.description}</p>
              <p className="text-xs text-muted">
                {p.deliveryDays}-day delivery · {p.revisions} revision{p.revisions === 1 ? '' : 's'}
              </p>
            </Card>
          </label>
        ))}
      </fieldset>

      {service.extras.length > 0 && (
        <fieldset className="flex flex-col gap-2 text-sm">
          <legend className="font-medium">Extras</legend>
          {service.extras.map((x) => (
            <label key={x.id} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={extraIds.includes(x.id)}
                  onChange={(e) =>
                    setExtraIds((ids) => (e.target.checked ? [...ids, x.id] : ids.filter((i) => i !== x.id)))
                  }
                />
                {x.title}
              </span>
              <span className="tabular-nums">+{money(x.priceAmount, service.currency)}</span>
            </label>
          ))}
        </fieldset>
      )}

      {service.requirementsForm.length > 0 && (
        <fieldset className="flex flex-col gap-3">
          <legend className="text-sm font-medium">The seller needs to know</legend>
          {service.requirementsForm.map((r, i) => (
            <TextareaField
              key={i}
              id={`answer-${i}`}
              label={r.label + (r.required ? ' *' : '')}
              rows={2}
              required={r.required}
              maxLength={5000}
            />
          ))}
        </fieldset>
      )}
      <TextareaField id="notes" label="Anything else? (optional)" rows={2} maxLength={5000} />

      <Card className="flex flex-col gap-1 text-sm" aria-live="polite" data-testid="price-breakdown">
        <div className="flex justify-between">
          <span>Total price</span>
          <span className="tabular-nums">{money(total, service.currency)}</span>
        </div>
        <div className="flex justify-between text-muted">
          <span>Delivery</span>
          <span>{days} days, in 3 milestones</span>
        </div>
        <hr className="my-1 border-border" />
        <p className="text-xs text-muted">
          You fund one milestone at a time. Money is held by the platform until you approve each milestone.
        </p>
        <div className="flex justify-between">
          <span>First milestone</span>
          <span className="tabular-nums">{money(first, service.currency)}</span>
        </div>
        {quote && quote.buyerFee > 0 && (
          <div className="flex justify-between">
            <span>Service fee</span>
            <span className="tabular-nums">{money(quote.buyerFee, service.currency)}</span>
          </div>
        )}
        <div className="flex justify-between font-semibold">
          <span>Due now</span>
          <span className="tabular-nums" data-testid="due-now">
            {money(quote ? quote.buyerTotal : first, service.currency)}
          </span>
        </div>
      </Card>

      {error && <Alert tone="danger">{error}</Alert>}
      <Button type="submit" disabled={pending}>
        {pending ? 'Placing order…' : 'Order & pay first milestone'}
      </Button>
      <p className="text-center text-xs text-muted">Test mode: no real money is charged.</p>
    </form>
  );
}
