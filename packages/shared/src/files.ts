import { z } from 'zod';
import { FILE_PURPOSES, type FilePurpose } from './enums';

const MB = 1024 * 1024;

/** Per-purpose upload limits (DECISIONS D-030). Enforced at presign AND re-checked after upload. */
export const FILE_RULES: Record<FilePurpose, { maxBytes: number; mimeTypes: readonly string[] }> = {
  avatar: { maxBytes: 5 * MB, mimeTypes: ['image/png', 'image/jpeg', 'image/webp'] },
  portfolio: {
    maxBytes: 25 * MB,
    mimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf', 'video/mp4'],
  },
  deliverable: {
    maxBytes: 500 * MB,
    mimeTypes: [
      'application/zip',
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/webp',
      'video/mp4',
      'application/vnd.android.package-archive',
      'text/plain',
    ],
  },
  message: {
    maxBytes: 25 * MB,
    mimeTypes: [
      'image/png',
      'image/jpeg',
      'image/webp',
      'image/gif',
      'application/pdf',
      'text/plain',
      'application/zip',
    ],
  },
  evidence: {
    maxBytes: 50 * MB,
    mimeTypes: ['image/png', 'image/jpeg', 'application/pdf', 'video/mp4', 'text/plain'],
  },
};

export const presignUploadSchema = z
  .object({
    purpose: z.enum(FILE_PURPOSES),
    fileName: z.string().trim().min(1).max(200),
    mimeType: z.string().trim().min(3).max(150),
    sizeBytes: z.number().int().positive(),
  })
  .superRefine((v, ctx) => {
    const rule = FILE_RULES[v.purpose];
    if (!rule.mimeTypes.includes(v.mimeType)) {
      ctx.addIssue({
        code: 'custom',
        path: ['mimeType'],
        message: `Type ${v.mimeType} is not allowed for ${v.purpose}`,
      });
    }
    if (v.sizeBytes > rule.maxBytes) {
      ctx.addIssue({
        code: 'custom',
        path: ['sizeBytes'],
        message: `Max size for ${v.purpose} is ${rule.maxBytes} bytes`,
      });
    }
  });
export type PresignUploadInput = z.infer<typeof presignUploadSchema>;
