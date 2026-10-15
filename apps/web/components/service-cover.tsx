import {
  Bot,
  BarChart3,
  Boxes,
  Cloud,
  Code2,
  Palette,
  ShieldCheck,
  Smartphone,
  type LucideIcon,
} from 'lucide-react';

const BY_CATEGORY: Record<string, { icon: LucideIcon; hue: number }> = {
  'web-development': { icon: Code2, hue: 160 },
  'mobile-apps': { icon: Smartphone, hue: 190 },
  'ai-ml': { icon: Bot, hue: 140 },
  saas: { icon: Boxes, hue: 170 },
  design: { icon: Palette, hue: 150 },
  devops: { icon: Cloud, hue: 200 },
  'qa-testing': { icon: ShieldCheck, hue: 130 },
  data: { icon: BarChart3, hue: 180 },
};

/**
 * Fallback cover when a service has no uploaded image: a calm gradient + category icon. Deterministic per
 * service (hue nudged by the slug) so a grid of cards does not look identical. It is decoration, not a photo.
 */
export function ServiceCover({
  category,
  seed,
  className = '',
}: {
  category: string;
  seed: string;
  className?: string;
}) {
  const c = BY_CATEGORY[category] ?? { icon: Code2, hue: 160 };
  const nudge = [...seed].reduce((a, ch) => (a + ch.charCodeAt(0)) % 40, 0) - 20;
  const hue = c.hue + nudge;
  const Icon = c.icon;
  return (
    <div
      aria-hidden
      className={`relative flex items-center justify-center overflow-hidden ${className}`}
      style={{
        background: `linear-gradient(135deg, hsl(${hue} 55% 14%), hsl(${hue + 25} 60% 22%) 60%, hsl(${hue} 70% 30%))`,
      }}
    >
      <div className="absolute -right-6 -top-6 size-32 rounded-full bg-white/5 blur-2xl" />
      <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:20px_20px]" />
      <Icon className="relative size-10 text-white/80" strokeWidth={1.4} />
    </div>
  );
}
