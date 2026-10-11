import { and, eq, idempotencyKeys, lt, type DbClient } from '@glasswork/db';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { DB } from '../../infra/tokens';

const TTL_MS = 24 * 60 * 60 * 1000;
const KEY_RE = /^[A-Za-z0-9_\-:.]{8,128}$/;

/**
 * `Idempotency-Key` handling for order and payment endpoints (D-015). Same key + same body replays the first
 * response; same key + different body is rejected; a concurrent duplicate gets 409 until the first finishes.
 */
@Injectable()
export class IdempotencyService {
  constructor(@Inject(DB) private readonly db: DbClient) {}

  requireKey(header: string | string[] | undefined): string {
    const key = Array.isArray(header) ? header[0] : header;
    if (!key || !KEY_RE.test(key)) {
      throw new BadRequestException(
        'A valid Idempotency-Key header (8–128 chars: letters, digits, _ - : .) is required',
      );
    }
    return key;
  }

  async run<T>(
    opts: { userId: string; scope: string; key: string; body: unknown },
    handler: () => Promise<T>,
  ): Promise<{ replayed: boolean; response: T }> {
    const requestHash = createHash('sha256')
      .update(JSON.stringify(opts.body ?? null))
      .digest('hex');
    await this.db.db.delete(idempotencyKeys).where(lt(idempotencyKeys.expiresAt, new Date()));

    const [claimed] = await this.db.db
      .insert(idempotencyKeys)
      .values({
        key: opts.key,
        userId: opts.userId,
        scope: opts.scope,
        requestHash,
        expiresAt: new Date(Date.now() + TTL_MS),
      })
      .onConflictDoNothing()
      .returning({ key: idempotencyKeys.key });

    if (!claimed) {
      const [existing] = await this.db.db
        .select()
        .from(idempotencyKeys)
        .where(
          and(
            eq(idempotencyKeys.userId, opts.userId),
            eq(idempotencyKeys.scope, opts.scope),
            eq(idempotencyKeys.key, opts.key),
          ),
        );
      if (existing?.requestHash !== requestHash) {
        throw new UnprocessableEntityException(
          'This Idempotency-Key was already used with a different request',
        );
      }
      if (existing.response === null)
        throw new ConflictException('A request with this Idempotency-Key is still in progress');
      return { replayed: true, response: existing.response as T };
    }

    try {
      const response = await handler();
      await this.db.db
        .update(idempotencyKeys)
        .set({ response: response as object, responseStatus: 200 })
        .where(
          and(
            eq(idempotencyKeys.userId, opts.userId),
            eq(idempotencyKeys.scope, opts.scope),
            eq(idempotencyKeys.key, opts.key),
          ),
        );
      return { replayed: false, response };
    } catch (err) {
      // A failed attempt must not poison the key: the client can retry with the same key.
      await this.db.db
        .delete(idempotencyKeys)
        .where(
          and(
            eq(idempotencyKeys.userId, opts.userId),
            eq(idempotencyKeys.scope, opts.scope),
            eq(idempotencyKeys.key, opts.key),
          ),
        );
      throw err;
    }
  }
}
