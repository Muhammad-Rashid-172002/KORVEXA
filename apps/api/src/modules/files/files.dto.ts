import { FILE_PURPOSES, FILE_STATUSES, presignUploadSchema } from '@glasswork/shared';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export class PresignUploadDto extends createZodDto(presignUploadSchema) {}

export const fileSchema = z.object({
  id: z.uuid(),
  originalName: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int(),
  purpose: z.enum(FILE_PURPOSES),
  status: z.enum(FILE_STATUSES),
  createdAt: z.iso.datetime(),
  uploadedAt: z.iso.datetime().nullable(),
});
export class FileDto extends createZodDto(fileSchema) {}

export class FileWithUrlDto extends createZodDto(
  fileSchema.extend({ downloadUrl: z.url().nullable(), downloadUrlExpiresAt: z.iso.datetime().nullable() }),
) {}

export class PresignUploadResponseDto extends createZodDto(
  z.object({
    file: fileSchema,
    upload: z.object({
      url: z.url(),
      method: z.literal('PUT'),
      headers: z.record(z.string(), z.string()),
      expiresAt: z.iso.datetime(),
    }),
  }),
) {}

export class FilePageDto extends createZodDto(z.object({ items: z.array(fileSchema), nextCursor: z.uuid().nullable() })) {}

export const listQuerySchema = z.object({
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export class ListFilesQueryDto extends createZodDto(listQuerySchema) {}

export class FileIdParamDto extends createZodDto(z.object({ id: z.uuid() })) {}
