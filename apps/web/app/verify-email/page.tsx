import type { Metadata } from 'next';
import { Suspense } from 'react';
import { VerifyEmailNotice } from './verify-email-notice';

export const metadata: Metadata = { title: 'Verify your email' };

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailNotice />
    </Suspense>
  );
}
