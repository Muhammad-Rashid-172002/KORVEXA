import type { ReactNode } from 'react';

/**
 * Original Glasswork category illustrations (240 x 240 viewBox, line-and-glass style). Drawn from simple shapes,
 * no stock photos and no real people. Colours come from currentColor (strokes) and the `accent` prop.
 * Sub-categories reuse their parent's scene with their own small badge glyph.
 */
type Scene = (a: string) => ReactNode;

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 3,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

const SCENES: Record<string, Scene> = {
  'web-development': (a) => (
    <g>
      <rect x="30" y="50" width="180" height="140" rx="14" {...stroke} />
      <path d="M30 80h180" {...stroke} />
      <circle cx="48" cy="65" r="4" fill={a} />
      <circle cx="62" cy="65" r="4" fill="currentColor" opacity=".5" />
      <circle cx="76" cy="65" r="4" fill="currentColor" opacity=".5" />
      <rect x="46" y="96" width="90" height="12" rx="6" fill={a} />
      <rect x="46" y="116" width="60" height="8" rx="4" fill="currentColor" opacity=".4" />
      <rect x="150" y="96" width="44" height="42" rx="8" {...stroke} />
      <rect x="46" y="146" width="40" height="30" rx="8" {...stroke} />
      <rect x="96" y="146" width="40" height="30" rx="8" {...stroke} />
      <rect x="146" y="150" width="48" height="26" rx="13" fill={a} />
    </g>
  ),
  'mobile-apps': (a) => (
    <g>
      <rect x="76" y="26" width="88" height="170" rx="18" {...stroke} />
      <path d="M108 38h24" {...stroke} />
      <rect x="90" y="56" width="60" height="34" rx="8" fill={a} opacity=".85" />
      <rect x="90" y="100" width="60" height="10" rx="5" fill="currentColor" opacity=".45" />
      <rect x="90" y="118" width="42" height="10" rx="5" fill="currentColor" opacity=".3" />
      <circle cx="120" cy="164" r="14" {...stroke} />
      <circle cx="176" cy="70" r="16" fill={a} />
      <path
        d="M169 70l5 5 9-10"
        stroke="#07110E"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="56" cy="150" r="8" {...stroke} />
    </g>
  ),
  'ai-ml': (a) => (
    <g>
      <path d="M120 120L60 70M120 120L180 70M120 120L56 168M120 120L184 168" {...stroke} opacity=".6" />
      <circle cx="120" cy="120" r="26" fill={a} />
      <path d="M120 106l4 10 10 4-10 4-4 10-4-10-10-4 10-4z" fill="#07110E" />
      <circle cx="60" cy="70" r="12" {...stroke} />
      <circle cx="180" cy="70" r="12" {...stroke} />
      <circle cx="56" cy="168" r="12" {...stroke} />
      <circle cx="184" cy="168" r="12" {...stroke} />
      <circle cx="60" cy="70" r="4" fill={a} />
      <circle cx="184" cy="168" r="4" fill={a} />
    </g>
  ),
  saas: (a) => (
    <g>
      <path d="M120 40l84 36-84 36-84-36z" fill={a} opacity=".9" />
      <path d="M36 112l84 36 84-36" {...stroke} />
      <path d="M36 148l84 36 84-36" {...stroke} opacity=".6" />
      <path d="M36 76v72M204 76v72" {...stroke} opacity=".4" />
      <circle cx="120" cy="76" r="8" fill="#07110E" />
    </g>
  ),
  design: (a) => (
    <g>
      <rect x="34" y="44" width="150" height="130" rx="12" {...stroke} />
      <path d="M58 150c20-50 40 10 62-30s32-30 44-44" {...stroke} stroke={a} strokeWidth="5" />
      <circle cx="58" cy="150" r="6" fill="#07110E" stroke={a} strokeWidth="3" />
      <circle cx="164" cy="76" r="6" fill="#07110E" stroke={a} strokeWidth="3" />
      <path d="M186 130l28-28 14 14-28 28-20 6z" fill={a} />
      <rect x="44" y="190" width="22" height="22" rx="6" fill={a} />
      <rect x="74" y="190" width="22" height="22" rx="6" fill="currentColor" opacity=".5" />
      <rect x="104" y="190" width="22" height="22" rx="6" {...stroke} />
    </g>
  ),
  devops: (a) => (
    <g>
      <path d="M70 150a30 30 0 0 1 4-60 44 44 0 0 1 84-8 34 34 0 0 1 8 68z" {...stroke} />
      <path
        d="M120 186v-52M100 154l20-22 20 22"
        stroke={a}
        strokeWidth="5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="190" cy="52" r="14" {...stroke} />
      <circle cx="190" cy="52" r="5" fill={a} />
      <circle cx="52" cy="196" r="6" fill={a} />
      <path d="M160 196h40" {...stroke} opacity=".5" />
    </g>
  ),
  'qa-testing': (a) => (
    <g>
      <path d="M120 28l76 28v56c0 44-32 72-76 88-44-16-76-44-76-88V56z" {...stroke} />
      <path
        d="M84 118l28 28 44-52"
        stroke={a}
        strokeWidth="9"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="188" cy="190" r="10" fill={a} />
      <path d="M180 182l-12-8M196 182l12-8M180 198l-12 8M196 198l12 8" {...stroke} strokeWidth="2.5" />
    </g>
  ),
  data: (a) => (
    <g>
      <path d="M40 40v150h160" {...stroke} />
      <rect x="62" y="120" width="26" height="70" rx="6" fill={a} opacity=".55" />
      <rect x="102" y="90" width="26" height="100" rx="6" fill={a} opacity=".8" />
      <rect x="142" y="60" width="26" height="130" rx="6" fill={a} />
      <path d="M56 100l50-30 40 18 50-44" {...stroke} />
      <circle cx="196" cy="44" r="6" fill="#07110E" stroke={a} strokeWidth="3" />
    </g>
  ),
};

export function CategoryArt({
  slug,
  accent = '#19C784',
  className,
  size,
}: {
  slug: string;
  accent?: string;
  className?: string;
  /** Fixed pixel size; needed when nested inside another SVG (otherwise it stretches to fill it). */
  size?: number;
}) {
  const scene = SCENES[slug] ?? SCENES['web-development']!;
  return (
    <svg
      viewBox="0 0 240 240"
      width={size}
      height={size}
      className={className}
      aria-hidden
      focusable="false"
      color="rgba(255,255,255,0.88)"
    >
      {scene(accent)}
    </svg>
  );
}

export const TOP_LEVEL_SLUGS = Object.keys(SCENES);
