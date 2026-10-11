import { sql, type DbClient } from '@glasswork/db';
import { Controller, Get, Inject } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { RequestActor } from '../../auth/session.service';
import { AdminScopeService } from '../../common/policy/admin-scope.service';
import { CurrentActor } from '../../common/policy/auth.guard';
import { Policy } from '../../common/policy/decorators';
import { DB } from '../../infra/tokens';

@ApiExcludeController()
@Controller('admin/ai')
export class AiAdminController {
  constructor(
    @Inject(DB) private readonly db: DbClient,
    private readonly scopes: AdminScopeService,
  ) {}

  /** Cost and volume per feature for the last 7 days, plus failures. Counts only; never prompts or outputs. */
  @Policy('admin role; operations or product scope reads AI spend', ['admin'])
  @Get('usage')
  async usage(@CurrentActor() a: RequestActor) {
    await this.scopes.require(a, ['operations', 'product']);
    const rows = await this.db.db.execute<{
      day: string;
      feature: string;
      calls: number;
      failed: number;
      input: string;
      output: string;
      cost: string;
    }>(sql`
      select to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as day, feature,
             count(*)::int as calls, count(*) filter (where not ok)::int as failed,
             coalesce(sum(input_tokens), 0) as input, coalesce(sum(output_tokens), 0) as output,
             coalesce(sum(cost_micros), 0) as cost
        from ai_usage where created_at >= now() - interval '7 days'
       group by 1, 2 order by 1 desc, 2`);
    return {
      rows: rows.rows.map((r) => ({
        day: r.day,
        feature: r.feature,
        calls: r.calls,
        failed: r.failed,
        inputTokens: Number(r.input),
        outputTokens: Number(r.output),
        costUsd: Number(r.cost) / 1_000_000,
      })),
    };
  }
}
