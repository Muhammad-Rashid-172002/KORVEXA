import { readConsent } from './consent';

/** Typed product-analytics events (brief Phase 8). Names are stable; add new ones here, never inline. */
export type AnalyticsEvent =
  | { name: 'cta_clicked'; props: { id: string; location: string } }
  | { name: 'service_viewed'; props: { slug: string } }
  | { name: 'search_performed'; props: { hasQuery: boolean; category?: string } }
  | { name: 'signup_started'; props: Record<string, never> }
  | { name: 'order_started'; props: { slug: string; tier: string } };

type Sink = (name: string, props: Record<string, unknown>) => void;
let sink: Sink | null = null;

/** Called once by the analytics provider (PostHog) after it loads, which only happens with consent and a key. */
export function registerAnalyticsSink(s: Sink | null): void {
  sink = s;
}

/** No-op unless the visitor chose "all" AND a provider registered. Never sends personal data in props. */
export function track<E extends AnalyticsEvent>(name: E['name'], props: E['props']): void {
  if (typeof window === 'undefined' || !sink) return;
  if (readConsent() !== 'all') return;
  sink(name, props as Record<string, unknown>);
}
