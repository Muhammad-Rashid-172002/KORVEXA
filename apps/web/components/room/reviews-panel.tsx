'use client';
import type { MilestoneView } from '@glasswork/shared';
import { Alert } from '@glasswork/ui/components/alert';
import { Button } from '@glasswork/ui/components/button';
import { Card, CardTitle } from '@glasswork/ui/components/card';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Stars } from '@/components/trust';
import { gw } from '@/lib/gw';
import { useLoad } from '@/lib/use-load';

interface ReviewState {
  canReview: boolean;
  review: { ratingOverall: number; body: string; createdAt: string } | null;
  feedback: { milestoneId: string; rating: number; body: string }[];
  feedbackOpen: string[];
}

const Rating = ({ name, label }: { name: string; label: string }) => (
  <label className="flex flex-col gap-1 text-xs text-muted">
    {label}
    <select
      name={name}
      defaultValue="5"
      className="h-9 rounded-md border border-border bg-bg px-2 text-sm text-fg"
      aria-label={label}
    >
      {[5, 4, 3, 2, 1].map((n) => (
        <option key={n} value={n}>
          {n} {n === 1 ? 'star' : 'stars'}
        </option>
      ))}
    </select>
  </label>
);

export function ReviewsPanel({
  projectId,
  isSeller,
  milestones,
}: {
  projectId: string;
  isSeller: boolean;
  milestones: MilestoneView[];
}) {
  const router = useRouter();
  const { data, reload } = useLoad<ReviewState>(`/projects/${projectId}/reviews`);
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  if (!data) return null;
  const title = (id: string) => milestones.find((m) => m.id === id)?.title ?? 'Milestone';

  async function submitFinal(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const n = (k: string) => Number(f.get(k));
    const r = await gw('POST', `/projects/${projectId}/review`, {
      ratingOverall: n('overall'),
      ratingCommunication: n('communication'),
      ratingQuality: n('quality'),
      ratingTimeliness: n('timeliness'),
      body: String(f.get('body') ?? '').trim(),
    });
    setMsg(
      r.ok
        ? { tone: 'success', text: 'Thank you. Your review is now public.' }
        : { tone: 'danger', text: r.error ?? 'Could not post the review' },
    );
    if (r.ok) {
      await reload();
      router.refresh();
    }
  }
  async function submitFeedback(e: FormEvent<HTMLFormElement>, milestoneId: string) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const r = await gw('POST', `/milestones/${milestoneId}/feedback`, {
      rating: Number(f.get('rating')),
      body: String(f.get('body') ?? '').trim(),
    });
    setMsg(
      r.ok
        ? { tone: 'success', text: 'Private feedback sent to the seller.' }
        : { tone: 'danger', text: r.error ?? 'Could not send feedback' },
    );
    if (r.ok) await reload();
  }

  const showAnything = data.canReview || data.review || data.feedbackOpen.length || data.feedback.length;
  if (!showAnything) return null;
  return (
    <section className="flex flex-col gap-3" aria-labelledby="rv" data-testid="reviews-panel">
      <h2 id="rv" className="text-lg font-semibold">
        Reviews &amp; feedback
      </h2>
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}

      {data.canReview && (
        <Card className="flex flex-col gap-3">
          <CardTitle>Review the seller</CardTitle>
          <p className="text-sm text-muted">Your review is public and can be answered once by the seller.</p>
          <form onSubmit={submitFinal} className="flex flex-col gap-3" data-testid="review-form">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Rating name="overall" label="Overall" />
              <Rating name="communication" label="Communication" />
              <Rating name="quality" label="Quality" />
              <Rating name="timeliness" label="Timeliness" />
            </div>
            <textarea
              name="body"
              rows={3}
              maxLength={3000}
              aria-label="Your review"
              placeholder="What was it like to work together?"
              className="rounded-md border border-border bg-bg px-3 py-2 text-sm"
            />
            <Button type="submit" className="self-start">
              Post review
            </Button>
          </form>
        </Card>
      )}
      {data.review && (
        <Card className="flex flex-col gap-1" data-testid="my-review">
          <CardTitle>{isSeller ? 'The buyer’s review' : 'Your review'}</CardTitle>
          <Stars value={data.review.ratingOverall} />
          {data.review.body && <p className="text-sm">{data.review.body}</p>}
        </Card>
      )}

      {!isSeller &&
        data.feedbackOpen.map((id) => (
          <Card key={id} className="flex flex-col gap-2" data-testid="feedback-card">
            <CardTitle>Private feedback: {title(id)}</CardTitle>
            <p className="text-xs text-muted">
              Only the seller sees this. It does not affect their public rating.
            </p>
            <form onSubmit={(e) => void submitFeedback(e, id)} className="flex flex-wrap items-end gap-2">
              <Rating name="rating" label="Rating" />
              <input
                name="body"
                maxLength={2000}
                aria-label={`Feedback on ${title(id)}`}
                placeholder="Optional note"
                className="h-9 min-w-48 flex-1 rounded-md border border-border bg-bg px-3 text-sm"
              />
              <Button size="sm" type="submit">
                Send
              </Button>
            </form>
          </Card>
        ))}
      {data.feedback.length > 0 && (
        <Card className="flex flex-col gap-2">
          <CardTitle>{isSeller ? 'Private feedback you received' : 'Your private feedback'}</CardTitle>
          <ul className="flex flex-col gap-1 text-sm" data-testid="feedback-given">
            {data.feedback.map((f) => (
              <li key={f.milestoneId} className="flex items-center gap-2">
                <Stars value={f.rating} /> <span className="text-muted">{title(f.milestoneId)}</span>{' '}
                {f.body && <span>: {f.body}</span>}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </section>
  );
}
