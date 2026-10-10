'use client';
import { Button } from '@glasswork/ui/components/button';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { authClient } from '@/lib/auth-client';
import { WEB_URL } from '@/lib/config';

type Providers = { google: boolean; github: boolean };

/** Google/GitHub buttons — rendered only when the API reports the provider keys are configured. */
export function OAuthButtons() {
  const [providers, setProviders] = useState<Providers | null>(null);
  useEffect(() => {
    api
      .GET('/v1/config/public')
      .then(({ data }) => setProviders(data?.oauth ?? null))
      .catch(() => setProviders(null));
  }, []);
  if (!providers || (!providers.google && !providers.github)) return null;

  const signIn = (provider: 'google' | 'github') =>
    authClient.signIn.social({ provider, callbackURL: `${WEB_URL}/dashboard`, errorCallbackURL: `${WEB_URL}/login?error=oauth` });

  return (
    <div className="flex flex-col gap-2">
      {providers.google && (
        <Button type="button" variant="secondary" onClick={() => void signIn('google')}>
          Continue with Google
        </Button>
      )}
      {providers.github && (
        <Button type="button" variant="secondary" onClick={() => void signIn('github')}>
          Continue with GitHub
        </Button>
      )}
      <div className="flex items-center gap-3 text-xs text-muted" aria-hidden>
        <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}
