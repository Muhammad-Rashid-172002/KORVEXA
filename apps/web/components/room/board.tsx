'use client';
import {
  TASK_STATUSES,
  type MilestoneView,
  type TaskCommentView,
  type TaskStatus,
  type TaskView,
} from '@glasswork/shared';
import { Alert } from '@glasswork/ui/components/alert';
import { Badge } from '@glasswork/ui/components/badge';
import { Button } from '@glasswork/ui/components/button';
import { MessageSquare } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { gw } from '@/lib/gw';
import { useLoad } from '@/lib/use-load';

type BoardData = { columns: Record<TaskStatus, TaskView[]> };
const LABEL: Record<TaskStatus, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  in_review: 'In review',
  done: 'Done',
};

function Comments({
  projectId,
  task,
  onChange,
}: {
  projectId: string;
  task: TaskView;
  onChange: () => void;
}) {
  const { data, reload } = useLoad<TaskCommentView[]>(`/projects/${projectId}/tasks/${task.id}/comments`);
  const [error, setError] = useState<string | null>(null);
  async function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const r = await gw('POST', `/projects/${projectId}/tasks/${task.id}/comments`, {
      body: String(new FormData(form).get('body')).trim(),
    });
    if (!r.ok) return setError(r.error);
    form.reset();
    setError(null);
    await reload();
    onChange();
  }
  return (
    <div className="flex flex-col gap-2 border-t border-border pt-2" data-testid="task-comments">
      {(data ?? []).map((c) => (
        <p key={c.id} className="text-xs">
          <strong>{c.author.name}:</strong> {c.body}
        </p>
      ))}
      {error && <Alert tone="danger">{error}</Alert>}
      <form onSubmit={add} className="flex gap-2">
        <input
          name="body"
          required
          maxLength={4000}
          aria-label={`Comment on ${task.title}`}
          placeholder="Add a comment"
          className="h-8 min-w-0 flex-1 rounded-md border border-border bg-bg px-2 text-xs"
        />
        <Button size="sm" type="submit">
          Post
        </Button>
      </form>
    </div>
  );
}

export function Board({
  projectId,
  isSeller,
  milestones,
  editable,
}: {
  projectId: string;
  isSeller: boolean;
  milestones: MilestoneView[];
  editable: boolean;
}) {
  const { data, error, reload } = useLoad<BoardData>(`/projects/${projectId}/board`);
  const [open, setOpen] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<TaskStatus | null>(null);

  async function addTask(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const r = await gw('POST', `/projects/${projectId}/tasks`, {
      title: String(f.get('title')).trim(),
      milestoneId: String(f.get('milestoneId') || '') || null,
    });
    if (!r.ok) return setMsg(r.error);
    form.reset();
    setMsg(null);
    await reload();
  }

  async function move(id: string, status: TaskStatus, position?: number) {
    const r = await gw('PATCH', `/projects/${projectId}/tasks/${id}`, {
      status,
      ...(position !== undefined && { position }),
    });
    if (!r.ok) setMsg(r.error);
    await reload();
  }

  if (!data) return <p className="text-sm text-muted">{error ?? 'Loading board…'}</p>;
  const mTitle = (id: string | null) => milestones.find((m) => m.id === id);

  return (
    <div className="flex flex-col gap-4">
      {isSeller && editable && (
        <form onSubmit={addTask} className="flex flex-wrap items-end gap-2" data-testid="add-task-form">
          <label className="flex flex-col gap-1 text-xs text-muted">
            New task
            <input
              name="title"
              required
              minLength={2}
              maxLength={160}
              className="h-9 w-64 rounded-md border border-border bg-bg px-3 text-sm text-fg"
              placeholder="e.g. Set up CI"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Milestone
            <select
              name="milestoneId"
              className="h-9 rounded-md border border-border bg-bg px-2 text-sm text-fg"
            >
              <option value="">None</option>
              {milestones.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.position}. {m.title}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" size="sm">
            Add task
          </Button>
        </form>
      )}
      {!isSeller && (
        <p className="text-xs text-muted">
          The seller manages the board. You can follow progress and comment on any task.
        </p>
      )}
      {msg && <Alert tone="danger">{msg}</Alert>}

      <div className="grid gap-3 md:grid-cols-4">
        {TASK_STATUSES.map((status) => (
          <section
            key={status}
            aria-label={LABEL[status]}
            data-testid={`column-${status}`}
            onDragOver={(e) => {
              if (isSeller && editable) {
                e.preventDefault();
                setOver(status);
              }
            }}
            onDragLeave={() => setOver(null)}
            onDrop={(e) => {
              e.preventDefault();
              setOver(null);
              if (dragging) void move(dragging, status, data.columns[status].length);
              setDragging(null);
            }}
            className={`flex min-h-32 flex-col gap-2 rounded-xl border bg-surface p-3 ${over === status ? 'border-primary' : 'border-border'}`}
          >
            <h3 className="flex items-center justify-between text-sm font-medium">
              {LABEL[status]}
              <Badge>{data.columns[status].length}</Badge>
            </h3>
            {data.columns[status].map((t) => (
              <article
                key={t.id}
                data-testid="task-card"
                draggable={isSeller && editable}
                onDragStart={() => setDragging(t.id)}
                className="flex flex-col gap-2 rounded-lg border border-border bg-bg p-3 text-sm"
              >
                <p className="font-medium">{t.title}</p>
                <p className="text-xs text-muted">
                  {mTitle(t.milestoneId) ? `Milestone ${mTitle(t.milestoneId)!.position}` : 'No milestone'}
                </p>
                <div className="flex items-center justify-between gap-2">
                  {isSeller && editable ? (
                    <select
                      aria-label={`Status of ${t.title}`}
                      value={t.status}
                      onChange={(e) => void move(t.id, e.target.value as TaskStatus)}
                      className="h-7 rounded-md border border-border bg-surface px-1 text-xs"
                    >
                      {TASK_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {LABEL[s]}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span />
                  )}
                  <button
                    type="button"
                    onClick={() => setOpen(open === t.id ? null : t.id)}
                    className="flex items-center gap-1 text-xs text-muted hover:text-fg"
                    aria-expanded={open === t.id}
                    aria-label={`Comments on ${t.title}`}
                  >
                    <MessageSquare size={12} aria-hidden /> {t.commentCount}
                  </button>
                </div>
                {open === t.id && <Comments projectId={projectId} task={t} onChange={() => void reload()} />}
                {isSeller && editable && (
                  <button
                    type="button"
                    className="self-start text-xs text-danger hover:underline"
                    onClick={async () => {
                      await gw('DELETE', `/projects/${projectId}/tasks/${t.id}`);
                      await reload();
                    }}
                  >
                    Delete
                  </button>
                )}
              </article>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
