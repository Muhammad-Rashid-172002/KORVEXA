/**
 * Platform settings keys (stored in platform_settings, editable by admins). Never hard-code fees (D-045).
 * Percentages are basis points (100 bps = 1%); amounts are minor units.
 */
export const SETTING_KEYS = {
  buyerServiceFeeBps: 'fees.buyer_service_bps',
  buyerServiceFeeMinAmount: 'fees.buyer_service_min_amount',
  sellerCommissionBps: 'fees.seller_commission_bps',
  sellerCommissionMinAmount: 'fees.seller_commission_min_amount',
  autoApproveDays: 'milestones.auto_approve_days',
} as const;

/** Compute a fee from settings. Integer math only: round half up on minor units. */
export function computeFee(amount: bigint, bps: number, minAmount: bigint = 0n): bigint {
  if (amount < 0n) throw new Error('amount must be >= 0');
  if (!Number.isInteger(bps) || bps < 0 || bps > 10_000) throw new Error('bps must be an integer 0..10000');
  const fee = (amount * BigInt(bps) + 5_000n) / 10_000n;
  return fee < minAmount ? minAmount : fee;
}
