import { gigTemplate } from '@glasswork/shared';
import { CategoryArt } from './category-art';

/** Sub-category slug -> top-level slug, so covers/illustrations stay consistent even when only the child is known. */
const PARENT: Record<string, string> = {
  'landing-pages': 'web-development',
  ecommerce: 'web-development',
  'web-apps': 'web-development',
  'cms-wordpress': 'web-development',
  ios: 'mobile-apps',
  android: 'mobile-apps',
  'cross-platform': 'mobile-apps',
  'app-maintenance': 'mobile-apps',
  'flutter-apps': 'mobile-apps',
  chatbots: 'ai-ml',
  'llm-integration': 'ai-ml',
  'computer-vision': 'ai-ml',
  'ml-models': 'ai-ml',
  'saas-mvp': 'saas',
  apis: 'saas',
  'payments-billing': 'saas',
  'auth-security': 'saas',
  'ui-design': 'design',
  'ux-research': 'design',
  'design-systems': 'design',
  branding: 'design',
  'ci-cd': 'devops',
  'cloud-infra': 'devops',
  containers: 'devops',
  monitoring: 'devops',
  'test-automation': 'qa-testing',
  'manual-qa': 'qa-testing',
  'performance-testing': 'qa-testing',
  'security-testing': 'qa-testing',
  dashboards: 'data',
  'data-pipelines': 'data',
  analytics: 'data',
  'data-collection': 'data',
};
export const topLevel = (slug: string) => PARENT[slug] ?? slug;

const hash = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);

/** Greedy word wrap for SVG text (no layout engine in SVG). */
function wrap(text: string, max: number, lines: number): string[] {
  const out: string[] = [];
  let cur = '';
  for (const w of text.split(/\s+/)) {
    if ((cur + ' ' + w).trim().length > max && cur) {
      out.push(cur);
      cur = w;
    } else cur = (cur + ' ' + w).trim();
  }
  if (cur) out.push(cur);
  if (out.length > lines) {
    out.length = lines;
    out[lines - 1] = out[lines - 1]!.replace(/\s*\S{0,3}$/, '') + '…';
  }
  return out;
}

const initials = (n: string) =>
  n
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

/**
 * Automatic branded cover for a gig that has no uploaded image: category colour + original illustration, the gig
 * title and the seller's name. Three layouts, picked per gig, so a grid of covers is varied. It is marked
 * data-autogen so the UI can say "auto-generated" and keep nudging the seller to upload a real image.
 */
export function ServiceCover({
  category,
  seed,
  title,
  seller,
  className = '',
}: {
  category: string;
  seed: string;
  title?: string;
  seller?: string;
  className?: string;
}) {
  const top = topLevel(category);
  const h = hash(seed);
  const hue = gigTemplate(top).hue + ((h % 30) - 15);
  const layout = h % 3;
  const accent = `hsl(${hue + 10} 75% 55%)`;
  const lines = wrap(title ?? '', layout === 1 ? 20 : 18, 3);
  const artRight = layout !== 2;
  const gid = `g${h}`;
  return (
    <svg
      viewBox="0 0 640 360"
      className={className}
      role="img"
      aria-label={title ? `Auto-generated cover for ${title}` : 'Auto-generated cover'}
      data-autogen="true"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={`hsl(${hue} 55% 10%)`} />
          <stop offset=".6" stopColor={`hsl(${hue + 20} 60% 18%)`} />
          <stop offset="1" stopColor={`hsl(${hue} 65% 28%)`} />
        </linearGradient>
      </defs>
      <rect width="640" height="360" fill={`url(#${gid})`} />
      <circle cx={artRight ? 520 : 120} cy="120" r="150" fill={accent} opacity=".12" />
      <circle cx={artRight ? 600 : 40} cy="330" r="90" fill="#fff" opacity=".04" />
      <g
        transform={
          artRight
            ? layout === 1
              ? 'translate(400 90) scale(0.85)'
              : 'translate(390 60) scale(0.98)'
            : 'translate(26 60) scale(0.98)'
        }
      >
        <CategoryArt slug={top} accent={accent} />
      </g>
      {title && (
        <text
          x={artRight ? 40 : 330}
          y={layout === 1 ? 120 : 130}
          fill="#fff"
          fontFamily="ui-sans-serif, system-ui, sans-serif"
          fontWeight="700"
          fontSize={28}
        >
          {lines.map((l, i) => (
            <tspan key={i} x={artRight ? 40 : 330} dy={i === 0 ? 0 : 36}>
              {l}
            </tspan>
          ))}
        </text>
      )}
      {seller && (
        <g transform={`translate(${artRight ? 40 : 330} 300)`}>
          <circle cx="18" cy="0" r="18" fill={accent} />
          <text
            x="18"
            y="5"
            textAnchor="middle"
            fontSize="14"
            fontWeight="700"
            fill="#07110E"
            fontFamily="ui-sans-serif, system-ui, sans-serif"
          >
            {initials(seller)}
          </text>
          <text
            x="46"
            y="5"
            fontSize="16"
            fill="#fff"
            opacity=".85"
            fontFamily="ui-sans-serif, system-ui, sans-serif"
          >
            {seller}
          </text>
        </g>
      )}
    </svg>
  );
}
