'use client';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { registerAnalyticsSink } from '@/lib/analytics';
import { CONSENT_EVENT, readConsent } from '@/lib/consent';

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

type PostHog = typeof import('posthog-js').default;
let client: PostHog | null = null;
let loading: Promise<PostHog | null> | null = null;

/** Loads posthog-js only with a configured key AND the visitor's consent. Autocapture and session replay stay off. */
async function load(): Promise<PostHog | null> {
  if (!KEY || readConsent() !== 'all') return null;
  if (client) return client;
  loading ??= import('posthog-js').then(({ default: posthog }) => {
    posthog.init(KEY, {
      api_host: HOST,
      autocapture: false,
      capture_pageview: false,
      disable_session_recording: true,
      persistence: 'localStorage',
      person_profiles: 'identified_only',
    });
    client = posthog;
    registerAnalyticsSink((name, props) => posthog.capture(name, props));
    return posthog;
  });
  return loading;
}

export function AnalyticsProvider() {
  const pathname = usePathname();
  useEffect(() => {
    if (!KEY) return;
    const onConsent = () => {
      if (readConsent() === 'all') void load();
      else if (client) {
        client.opt_out_capturing();
        registerAnalyticsSink(null);
        client = null;
        loading = null;
      }
    };
    onConsent();
    window.addEventListener(CONSENT_EVENT, onConsent);
    return () => window.removeEventListener(CONSENT_EVENT, onConsent);
  }, []);
  useEffect(() => {
    if (!KEY || readConsent() !== 'all') return;
    void load().then((ph) => ph?.capture('$pageview', { $current_url: window.location.origin + pathname }));
  }, [pathname]);
  return null;
}
