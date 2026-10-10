'use client';
import { Alert } from '@glasswork/ui/components/alert';
import { Button } from '@glasswork/ui/components/button';
import { MailCheck } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { AuthCard } from '@/components/auth-card';
import { authClient } from '@/lib/auth-client';
import { WEB_URL } from '@/lib/config';

export function VerifyEmailNotice() {
  const email = useSearchParams().get('email');
  const [status, setStatus] = useState<'idle' | 'sent' | 'error'>('idle');

  async function resend() {
    if (!email) return;
    const { error } = await authClient.sendVerificationEmail({ email, callbackURL: `${WEB_URL}/dashboard` });
    setStatus(error ? 'error' : 'sent');
  }

  return (
    <AuthCard title="Check your inbox">
      <div className="flex items-start gap-3">
        <MailCheck className="mt-0.5 shrink-0 text-primary" size={20} aria-hidden />
        <p className="text-sm">
          We sent a verification link to {email ? <strong>{email}</strong> : 'your email'}. Open it to activate your
          account — the link expires in 1 hour.
        </p>
      </div>
      {status === 'sent' && <Alert tone="success">A new link is on its way.</Alert>}
      {status === 'error' && <Alert tone="danger">Couldn’t resend right now. Try again in a minute.</Alert>}
      {email && (
        <Button variant="secondary" onClick={() => void resend()}>
          Resend link
        </Button>
      )}
    </AuthCard>
  );
}
