import { computeFee } from './settings';

export interface MilestoneTemplateItem {
  title: string;
  percent: number;
}

/** Used when a package defines no milestone split (DECISIONS D-066). Percentages sum to 100. */
export const DEFAULT_MILESTONE_TEMPLATE: readonly MilestoneTemplateItem[] = [
  { title: 'Kickoff & plan', percent: 30 },
  { title: 'Build', percent: 40 },
  { title: 'Delivery & handover', percent: 30 },
];

/**
 * Splits `total` (minor units) by integer percentages. Every part is an integer, the parts always sum to
 * exactly `total` (the rounding remainder goes to the last part), and no part is negative.
 */
export function splitByPercent(total: number, percents: readonly number[]): number[] {
  if (!Number.isSafeInteger(total) || total < 0) throw new Error('total must be a non-negative integer');
  if (percents.length === 0) throw new Error('at least one part is required');
  if (percents.some((p) => !Number.isInteger(p) || p <= 0))
    throw new Error('percents must be positive integers');
  if (percents.reduce((a, b) => a + b, 0) !== 100) throw new Error('percents must sum to 100');
  const parts = percents.map((p) => Math.floor((total * p) / 100));
  const assigned = parts.reduce((a, b) => a + b, 0);
  parts[parts.length - 1]! += total - assigned;
  return parts;
}

export interface FeeSettings {
  buyerServiceBps: number;
  buyerServiceMin: number;
  sellerCommissionBps: number;
  sellerCommissionMin: number;
}

export interface FeeQuote {
  /** Milestone price. */
  amount: number;
  /** Added on top for the buyer. */
  buyerFee: number;
  /** What the buyer pays in total. */
  buyerTotal: number;
  /** Deducted from the seller's side at release. */
  sellerCommission: number;
  /** What the seller receives at release. */
  sellerNet: number;
}

/** Transparent fee breakdown shown before payment (brief §9). Integer math only (D-006, D-045). */
export function quoteFees(amount: number, s: FeeSettings): FeeQuote {
  if (!Number.isSafeInteger(amount) || amount < 0) throw new Error('amount must be a non-negative integer');
  const buyerFee = Number(computeFee(BigInt(amount), s.buyerServiceBps, BigInt(s.buyerServiceMin)));
  // Commission can never exceed the price: the seller's net is never negative.
  const sellerCommission = Math.min(
    amount,
    Number(computeFee(BigInt(amount), s.sellerCommissionBps, BigInt(s.sellerCommissionMin))),
  );
  return {
    amount,
    buyerFee,
    buyerTotal: amount + buyerFee,
    sellerCommission,
    sellerNet: amount - sellerCommission,
  };
}
