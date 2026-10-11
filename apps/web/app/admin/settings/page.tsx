import { Card, CardTitle } from '@glasswork/ui/components/card';
import type { Metadata } from 'next';
import { serverGw } from '@/lib/server-gw';
import { FeeSettingsForm } from './fee-settings-form';

export const metadata: Metadata = { title: 'Admin · Fee settings' };

export default async function AdminSettings() {
  const res = await serverGw<{
    buyerServiceBps: number;
    buyerServiceMin: number;
    sellerCommissionBps: number;
    sellerCommissionMin: number;
    autoApproveDays: number;
  }>('/admin/settings/fees');
  return (
    <Card className="flex max-w-xl flex-col gap-3">
      <CardTitle>Fees &amp; timers</CardTitle>
      <p className="text-sm text-muted">
        Percentages are basis points (100 = 1%). Minimums are in cents. The platform ships with zero
        placeholder fees until the partners decide the real values. Changes apply to milestones funded from
        now on and are audit-logged.
      </p>
      {res.data ? (
        <FeeSettingsForm initial={res.data} />
      ) : (
        <p className="text-sm text-muted">Unable to load settings.</p>
      )}
    </Card>
  );
}
