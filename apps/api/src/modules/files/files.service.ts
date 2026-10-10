import { auditLogs, filesRepository, type DbClient, type FileRow, type FilesRepository } from '@glasswork/db';
import type { CursorPage, PresignUploadInput } from '@glasswork/shared';
import { Inject, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { uuidv7 } from 'uuidv7';
import type { RequestActor } from '../../auth/session.service';
import { DB } from '../../infra/tokens';
import type { FileDto, FileWithUrlDto, PresignUploadResponseDto } from './files.dto';
import { DOWNLOAD_URL_TTL_SECONDS, StorageService, UPLOAD_URL_TTL_SECONDS } from './storage.service';

const toDto = (f: FileRow): FileDto => ({
  id: f.id,
  originalName: f.originalName,
  mimeType: f.mimeType,
  sizeBytes: f.sizeBytes,
  purpose: f.purpose,
  status: f.status,
  createdAt: f.createdAt.toISOString(),
  uploadedAt: f.uploadedAt?.toISOString() ?? null,
});

@Injectable()
export class FilesService {
  private readonly repo: FilesRepository;

  constructor(
    @Inject(DB) private readonly db: DbClient,
    private readonly storage: StorageService,
  ) {
    this.repo = filesRepository(db.db);
  }

  async presignUpload(actor: RequestActor, input: PresignUploadInput): Promise<PresignUploadResponseDto> {
    const id = uuidv7();
    const storageKey = `u/${actor.userId}/${id}`;
    const file = await this.repo.create(
      { userId: actor.userId },
      {
        id,
        storageKey,
        originalName: input.fileName,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        purpose: input.purpose,
      },
    );
    const url = await this.storage.presignPut(storageKey, input.mimeType, input.sizeBytes);
    return {
      file: toDto(file),
      upload: {
        url,
        method: 'PUT',
        headers: { 'content-type': input.mimeType },
        expiresAt: new Date(Date.now() + UPLOAD_URL_TTL_SECONDS * 1000).toISOString(),
      },
    };
  }

  /** Verifies the object actually landed with the declared size/type before accepting it. */
  async completeUpload(actor: RequestActor, id: string, ip?: string): Promise<FileDto> {
    const file = await this.repo.findOwned({ userId: actor.userId }, id);
    if (!file) throw new NotFoundException('File not found');
    if (file.status !== 'pending') return toDto(file);

    const head = await this.storage.head(file.storageKey);
    if (!head) throw new UnprocessableEntityException('Upload not found in storage yet');
    const typeOk = head.contentType === undefined || head.contentType === file.mimeType;
    if (head.size !== file.sizeBytes || !typeOk) {
      await this.storage.delete(file.storageKey);
      await this.repo.updateOwned({ userId: actor.userId }, id, { status: 'rejected' });
      throw new UnprocessableEntityException('Uploaded object does not match the declared size/type');
    }

    // TODO(Phase 4): enqueue ClamAV scan; until then files are only ever visible to their owner (D-030).
    const updated = await this.repo.updateOwned({ userId: actor.userId }, id, { status: 'clean', uploadedAt: new Date() });
    await this.db.db.insert(auditLogs).values({
      actorId: actor.userId,
      action: 'file.uploaded',
      entityType: 'file',
      entityId: id,
      after: { sizeBytes: file.sizeBytes, mimeType: file.mimeType, purpose: file.purpose },
      ip: ip ?? null,
    });
    return toDto(updated ?? file);
  }

  async getOwned(actor: RequestActor, id: string): Promise<FileWithUrlDto> {
    const file = await this.repo.findOwned({ userId: actor.userId }, id);
    // 404 (not 403) for other users' files so existence isn't leaked (D-011).
    if (!file) throw new NotFoundException('File not found');
    const downloadable = file.status === 'clean';
    return {
      ...toDto(file),
      downloadUrl: downloadable ? await this.storage.presignGet(file.storageKey, file.originalName) : null,
      downloadUrlExpiresAt: downloadable ? new Date(Date.now() + DOWNLOAD_URL_TTL_SECONDS * 1000).toISOString() : null,
    };
  }

  async listOwned(actor: RequestActor, q: { cursor?: string; limit: number }): Promise<CursorPage<FileDto>> {
    const rows = await this.repo.listOwned({ userId: actor.userId }, { cursor: q.cursor, limit: q.limit + 1 });
    const page = rows.slice(0, q.limit);
    return { items: page.map(toDto), nextCursor: rows.length > q.limit ? (page.at(-1)?.id ?? null) : null };
  }
}
