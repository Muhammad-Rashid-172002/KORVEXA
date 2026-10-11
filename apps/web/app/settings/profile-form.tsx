/* eslint-disable @next/next/no-img-element -- avatars/portfolio are short-lived presigned storage URLs, not optimisable by next/image */
'use client';
import type { ProfileView } from '@glasswork/shared';
import { Alert } from '@glasswork/ui/components/alert';
import { Button } from '@glasswork/ui/components/button';
import { useRouter } from 'next/navigation';
import { useRef, useState, type FormEvent } from 'react';
import { Field } from '@/components/field';
import { TextareaField } from '@/components/textarea-field';
import { gw, uploadFile } from '@/lib/gw';

export function ProfileForm({ profile }: { profile: ProfileView }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const text = (k: string) => String(f.get(k) ?? '').trim();
    setPending(true);
    const r = await gw('PATCH', '/me/profile', {
      displayName: text('displayName'),
      headline: text('headline') || null,
      bio: text('bio') || null,
      country: text('country').toUpperCase() || null,
      slug: text('slug').toLowerCase() || null,
    });
    setPending(false);
    setMsg(
      r.ok ? { tone: 'success', text: 'Profile saved.' } : { tone: 'danger', text: r.error ?? 'Failed' },
    );
    if (r.ok) router.refresh();
  }

  async function onAvatar(file: File) {
    setPending(true);
    try {
      const id = await uploadFile(file, 'avatar');
      const r = await gw('PUT', '/me/profile/avatar', { fileId: id });
      if (!r.ok) throw new Error(r.error ?? 'Could not set avatar');
      setMsg({ tone: 'success', text: 'Avatar updated.' });
      router.refresh();
    } catch (e) {
      setMsg({ tone: 'danger', text: e instanceof Error ? e.message : 'Upload failed' });
    } finally {
      setPending(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={onSubmit}>
      <div className="flex items-center gap-4">
        {profile.avatarUrl ? (
          <img src={profile.avatarUrl} alt="Your avatar" className="size-16 rounded-full object-cover" />
        ) : (
          <div
            className="flex size-16 items-center justify-center rounded-full bg-surface-2 text-lg"
            aria-hidden
          >
            {profile.displayName.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div>
          <input
            ref={fileRef}
            id="avatar-input"
            data-testid="avatar-input"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onAvatar(f);
            }}
          />
          <Button asChild variant="secondary" size="sm">
            <label htmlFor="avatar-input">Change avatar</label>
          </Button>
        </div>
      </div>
      <Field
        id="displayName"
        label="Display name"
        defaultValue={profile.displayName}
        required
        maxLength={80}
      />
      <Field id="headline" label="Headline" defaultValue={profile.headline ?? ''} maxLength={120} />
      <TextareaField id="bio" label="About you" defaultValue={profile.bio ?? ''} maxLength={2000} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id="country"
          label="Country (2-letter code)"
          defaultValue={profile.country ?? ''}
          maxLength={2}
        />
        <Field
          id="slug"
          label="Public handle"
          defaultValue={profile.slug ?? ''}
          hint="3–40 letters, digits or hyphens. Leave empty to keep your profile private."
        />
      </div>
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? 'Saving…' : 'Save profile'}
      </Button>
    </form>
  );
}
