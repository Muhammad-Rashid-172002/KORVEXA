import { brand } from '@glasswork/shared/brand';
import { Alert } from '@glasswork/ui/components/alert';
import { Avatar } from '@glasswork/ui/components/avatar';
import { Badge } from '@glasswork/ui/components/badge';
import { Button } from '@glasswork/ui/components/button';
import { Card, CardDescription, CardTitle } from '@glasswork/ui/components/card';
import { EmptyState } from '@glasswork/ui/components/empty-state';
import { Input } from '@glasswork/ui/components/input';
import { PageHeader } from '@glasswork/ui/components/page-header';
import { Progress } from '@glasswork/ui/components/progress';
import { Skeleton } from '@glasswork/ui/components/skeleton';
import { Stat } from '@glasswork/ui/components/stat';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@glasswork/ui/components/tabs';
import { Inbox } from 'lucide-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ProductMark } from '@/components/product-mark';
import { ServiceCover } from '@/components/service-cover';
import { Stars } from '@/components/trust';
import { DesignOverlays } from './overlays';

export const metadata: Metadata = { title: 'Design system', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const TOKENS = [
  ['bg', 'bg-bg'],
  ['surface', 'bg-surface'],
  ['surface-2', 'bg-surface-2'],
  ['border', 'bg-border'],
  ['primary', 'bg-primary'],
  ['success', 'bg-success'],
  ['warning', 'bg-warning'],
  ['danger', 'bg-danger'],
  ['info', 'bg-info'],
] as const;

const SCALE = [
  ['text-xs', '12 · captions, badges'],
  ['text-sm', '14 · app body (default)'],
  ['text-base', '16 · marketing body'],
  ['text-lg', '18 · card titles'],
  ['text-2xl', '24 · page titles'],
  ['text-4xl', '36 · marketing headings'],
  ['text-6xl', '60 · hero'],
] as const;

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4" aria-label={title}>
      <h2 className="border-b border-border pb-2 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

/** Living style guide. Only served when ENABLE_STYLEGUIDE=1 (development and screenshots), never in production. */
export default function DesignPage() {
  if (process.env.ENABLE_STYLEGUIDE !== '1') notFound();
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-12 px-4 py-12">
      <PageHeader
        eyebrow="Design system"
        title={`${brand.productName} components`}
        description="Tokens, type, components and states. Every component supports dark and light themes, keyboard use and reduced motion."
      />

      <Group title="Brand">
        <div className="flex flex-wrap items-center gap-6">
          <ProductMark size={56} />
          <ProductMark size={32} />
          <ProductMark size={20} />
        </div>
      </Group>

      <Group title="Colour tokens">
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
          {TOKENS.map(([name, cls]) => (
            <div key={name} className="flex flex-col gap-1.5 text-xs">
              <div className={`h-14 rounded-lg border border-border ${cls}`} />
              <span className="font-mono text-muted">{name}</span>
            </div>
          ))}
        </div>
      </Group>

      <Group title="Type scale (Geist)">
        <div className="flex flex-col gap-3">
          {SCALE.map(([cls, note]) => (
            <div key={cls} className="flex flex-wrap items-baseline gap-4 border-b border-border/50 pb-2">
              <span className={`${cls} font-semibold tracking-tight`}>Milestones, made visible</span>
              <span className="font-mono text-xs text-muted">{note}</span>
            </div>
          ))}
          <p className="font-mono text-sm tabular-nums">Tabular figures: $12,480.00 · 62% · GW-0042</p>
        </div>
      </Group>

      <Group title="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button disabled>Disabled</Button>
          <Button size="sm">Small</Button>
          <Button size="lg">Large</Button>
        </div>
      </Group>

      <Group title="Inputs, badges, alerts">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input placeholder="Text input" aria-label="Example input" />
          <div className="flex flex-wrap items-center gap-2">
            <Badge>Neutral</Badge>
            <Badge className="border-success/50 text-success">Verified</Badge>
            <Badge className="border-warning/50 text-warning">At risk</Badge>
            <Badge className="border-danger/50 text-danger">Blocked</Badge>
            <Stars value={4.8} count={32} />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Alert>Information: the review window ends in 3 days.</Alert>
          <Alert tone="success">Milestone approved. Funds released.</Alert>
          <Alert tone="warning">Contact details were shared before an order exists.</Alert>
          <Alert tone="danger">Payment failed. Try another method.</Alert>
        </div>
      </Group>

      <Group title="Data display">
        <div className="grid gap-3 sm:grid-cols-4">
          <Stat label="Escrow held" value="$1,800.00" hint="1 milestone" />
          <Stat label="Completed projects" value={12} />
          <Stat label="On-time delivery" value="96%" />
          <Stat label="Response time" value={null} hint="Not enough data yet" />
        </div>
        <div className="max-w-md space-y-2">
          <Progress value={62} label="Project progress 62 percent" />
          <p className="text-xs text-muted">Progress bar (determinate, animated, respects reduced motion)</p>
        </div>
        <div className="flex items-center gap-3">
          <Avatar name="Amara Okafor" size="sm" />
          <Avatar name="Rohan Mehta" size="md" />
          <Avatar name="Elena Petrova" size="lg" />
          <Avatar name="Kenji Watanabe" size="xl" />
        </div>
      </Group>

      <Group title="Cards & covers">
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="card-lift">
            <CardTitle>Card</CardTitle>
            <CardDescription>Solid surface, 12px radius, lifts on hover.</CardDescription>
          </Card>
          {['web-development', 'ai-ml'].map((c) => (
            <ServiceCover key={c} category={c} seed={c} className="aspect-video rounded-xl" />
          ))}
        </div>
      </Group>

      <Group title="Loading & empty states">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Skeleton className="aspect-video w-full" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
          </div>
          <EmptyState
            icon={<Inbox />}
            title="Nothing here yet"
            description="Helpful empty states say what this is and what to do next."
            action={<Button size="sm">Primary action</Button>}
          />
        </div>
      </Group>

      <Group title="Tabs">
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="board">Board</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="text-sm text-muted">
            Overview content
          </TabsContent>
          <TabsContent value="timeline" className="text-sm text-muted">
            Timeline content
          </TabsContent>
          <TabsContent value="board" className="text-sm text-muted">
            Board content
          </TabsContent>
        </Tabs>
      </Group>

      <Group title="Overlays (glass)">
        <DesignOverlays />
      </Group>
    </div>
  );
}
