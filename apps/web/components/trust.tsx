import { VERIFICATION_LABELS, type SellerLevelKey, type VerificationKind } from '@glasswork/shared';
import { Badge } from '@glasswork/ui/components/badge';
import { BadgeCheck, Star } from 'lucide-react';

export function Stars({ value, count, size = 14 }: { value: number | null; count?: number; size?: number }) {
  if (value === null) return <span className="text-xs text-muted">No reviews yet</span>;
  return (
    <span
      className="inline-flex items-center gap-1 text-sm"
      data-testid="rating"
      aria-label={`Rated ${value.toFixed(1)} out of 5${count !== undefined ? ` from ${count} reviews` : ''}`}
    >
      <Star size={size} aria-hidden className="fill-warning text-warning" />
      <span className="font-medium tabular-nums">{value.toFixed(1)}</span>
      {count !== undefined && <span className="text-xs text-muted">({count})</span>}
    </span>
  );
}

export function LevelBadge({ level, label }: { level: SellerLevelKey; label: string }) {
  return (
    <Badge className={level === 'new' ? '' : 'border-primary/50 text-primary'} data-testid="level-badge">
      {label}
    </Badge>
  );
}

export function VerifiedBadges({ badges }: { badges: VerificationKind[] }) {
  if (!badges.length) return null;
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Verifications" data-testid="verified-badges">
      {badges.map((b) => (
        <li key={b}>
          <Badge className="gap-1 border-success/50 text-success">
            <BadgeCheck size={12} aria-hidden /> {VERIFICATION_LABELS[b]}
          </Badge>
        </li>
      ))}
    </ul>
  );
}
