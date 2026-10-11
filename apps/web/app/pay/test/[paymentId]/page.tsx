import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { serverGw } from '@/lib/server-gw';
import { TestCheckout } from './test-checkout';

export const metadata: Metadata = { title: 'Test checkout' };
export const dynamic = 'force-dynamic';

interface Payment {
  id: string;
  status: string;
  provider: string;
  amount: number;
  buyerFeeAmount: number;
  currency: string;
  projectId: string | null;
}

export default async function TestCheckoutPage({ params }: { params: Promise<{ paymentId: string }> }) {
  const { paymentId } = await params;
  const res = await serverGw<Payment>(`/payments/${paymentId}`);
  if (res.status === 401) redirect(`/login?next=/pay/test/${paymentId}`);
  if (!res.data || res.data.provider !== 'test') redirect('/projects');
  return <TestCheckout payment={res.data} />;
}
