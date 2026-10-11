import { Label } from '@glasswork/ui/components/label';
import type { TextareaHTMLAttributes } from 'react';

export function TextareaField({
  label,
  id,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; id: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <textarea
        id={id}
        name={id}
        rows={4}
        className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-muted"
        {...props}
      />
    </div>
  );
}
