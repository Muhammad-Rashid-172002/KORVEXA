import { eq, users, type DbClient } from '@glasswork/db';
import { Inject, Injectable } from '@nestjs/common';
import type { IncomingHttpHeaders } from 'node:http';
import { AUTH, DB } from '../infra/tokens';
import type { Auth } from './auth';

/** The authenticated principal attached to requests and sockets. */
export interface RequestActor {
  userId: string;
  email: string;
  name: string;
  sessionId: string;
}

@Injectable()
export class SessionService {
  constructor(
    @Inject(AUTH) private readonly auth: Auth,
    @Inject(DB) private readonly db: DbClient,
  ) {}

  /** Resolves the session from a cookie or `Authorization: Bearer` header. Returns null when absent/invalid. */
  async resolve(rawHeaders: IncomingHttpHeaders): Promise<RequestActor | null> {
    const headers = new Headers();
    for (const [k, v] of Object.entries(rawHeaders)) {
      if (v === undefined) continue;
      headers.set(k, Array.isArray(v) ? v.join(', ') : String(v));
    }
    const result = await this.auth.api.getSession({ headers });
    if (!result) return null;
    // A banned account is treated as signed out everywhere (HTTP and sockets), even with a still-valid cached session.
    const [row] = await this.db.db
      .select({ bannedAt: users.bannedAt, deletedAt: users.deletedAt })
      .from(users)
      .where(eq(users.id, result.user.id));
    if (!row || row.bannedAt || row.deletedAt) return null;
    return {
      userId: result.user.id,
      email: result.user.email,
      name: result.user.name,
      sessionId: result.session.id,
    };
  }
}
