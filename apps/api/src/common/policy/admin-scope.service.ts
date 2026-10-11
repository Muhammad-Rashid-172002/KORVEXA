import { eq, users, type DbClient } from '@glasswork/db';
import type { AdminScope } from '@glasswork/shared';
import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import type { RequestActor } from '../../auth/session.service';
import { DB } from '../../infra/tokens';

/** Scope check for admin actions that need more than the `admin` role (D-003): throws 403 unless one scope matches. */
@Injectable()
export class AdminScopeService {
  constructor(@Inject(DB) private readonly db: DbClient) {}

  async require(actor: RequestActor, allowed: readonly AdminScope[]): Promise<void> {
    const [me] = await this.db.db
      .select({ scopes: users.adminScopes })
      .from(users)
      .where(eq(users.id, actor.userId));
    if (!me?.scopes.some((s) => allowed.includes(s))) {
      throw new ForbiddenException(`Requires one of the admin scopes: ${allowed.join(', ')}`);
    }
  }
}
