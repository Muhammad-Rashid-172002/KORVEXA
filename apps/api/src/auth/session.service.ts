import { Inject, Injectable } from '@nestjs/common';
import type { IncomingHttpHeaders } from 'node:http';
import { AUTH } from '../infra/tokens';
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
  constructor(@Inject(AUTH) private readonly auth: Auth) {}

  /** Resolves the session from a cookie or `Authorization: Bearer` header. Returns null when absent/invalid. */
  async resolve(rawHeaders: IncomingHttpHeaders): Promise<RequestActor | null> {
    const headers = new Headers();
    for (const [k, v] of Object.entries(rawHeaders)) {
      if (v === undefined) continue;
      headers.set(k, Array.isArray(v) ? v.join(', ') : String(v));
    }
    const result = await this.auth.api.getSession({ headers });
    if (!result) return null;
    return {
      userId: result.user.id,
      email: result.user.email,
      name: result.user.name,
      sessionId: result.session.id,
    };
  }
}
