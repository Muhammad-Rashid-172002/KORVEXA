import { eq, users, type DbClient } from '@glasswork/db';
import {
  type CanActivate,
  createParamDecorator,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import { SessionService, type RequestActor } from '../../auth/session.service';
import { DB } from '../../infra/tokens';
import { IS_PUBLIC, POLICY, type PolicyMeta } from './decorators';
import { hasAnyRole } from './policies';

declare module 'fastify' {
  interface FastifyRequest {
    actor?: RequestActor;
  }
}

/** Global HTTP guard: authenticates every non-public route and enforces declared role requirements. */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionService,
    @Inject(DB) private readonly db: DbClient,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (ctx.getType() !== 'http') return true; // sockets authenticate in the gateway handshake
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;

    const policy = this.reflector.getAllAndOverride<PolicyMeta>(POLICY, targets);
    if (!policy) throw new ForbiddenException('Route has no policy'); // defence in depth; boot audit catches this

    const req = ctx.switchToHttp().getRequest<FastifyRequest>();
    const actor = await this.sessions.resolve(req.headers);
    if (!actor) throw new UnauthorizedException('Sign in required');

    if (policy.roles.length > 0) {
      const [row] = await this.db.db.select({ roles: users.roles }).from(users).where(eq(users.id, actor.userId));
      if (!row || !hasAnyRole(row.roles, policy.roles)) throw new ForbiddenException('Insufficient role');
    }
    req.actor = actor;
    return true;
  }
}

/** Injects the authenticated actor (only valid on @Policy routes). */
export const CurrentActor = createParamDecorator((_: unknown, ctx: ExecutionContext): RequestActor => {
  const req = ctx.switchToHttp().getRequest<FastifyRequest>();
  if (!req.actor) throw new UnauthorizedException();
  return req.actor;
});
