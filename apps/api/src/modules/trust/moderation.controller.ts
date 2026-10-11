import { reportDecisionSchema, reportInputSchema } from '@glasswork/shared';
import { disputeEvidence, eq, files, type DbClient } from '@glasswork/db';
import { Body, Controller, Get, Inject, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import type { RequestActor } from '../../auth/session.service';
import { AdminScopeService } from '../../common/policy/admin-scope.service';
import { CurrentActor } from '../../common/policy/auth.guard';
import { Policy } from '../../common/policy/decorators';
import { DB } from '../../infra/tokens';
import { StorageService } from '../files/storage.service';
import { ReportsService } from './reports.service';

class IdDto extends createZodDto(z.object({ id: z.uuid() })) {}
class ReportDto extends createZodDto(reportInputSchema) {}
class DecisionDto extends createZodDto(reportDecisionSchema) {}
class ReasonDto extends createZodDto(z.object({ reason: z.string().trim().min(5).max(500) })) {}
class QueueDto extends createZodDto(
  z.object({ status: z.enum(['open', 'actioned', 'dismissed']).default('open') }),
) {}

@ApiExcludeController()
@Controller()
export class ModerationController {
  constructor(
    private readonly reports: ReportsService,
    private readonly scopes: AdminScopeService,
    private readonly storage: StorageService,
    @Inject(DB) private readonly db: DbClient,
  ) {}

  @Policy('any signed-in user may report things they can see; rate limited and de-duplicated')
  @Post('reports')
  report(@CurrentActor() a: RequestActor, @Body() b: ReportDto) {
    return this.reports.create(a, b);
  }

  @Policy('admin role required to read the reports queue', ['admin'])
  @Get('admin/reports')
  queue(@Query() q: QueueDto) {
    return this.reports.queue(q.status);
  }

  @Policy('operations or product admins decide reports, with a note', ['admin'])
  @Post('admin/reports/:id/decision')
  async decide(@CurrentActor() a: RequestActor, @Param() p: IdDto, @Body() b: DecisionDto) {
    await this.scopes.require(a, ['operations', 'product']);
    return this.reports.decide(a, p.id, b.decision, b.note);
  }

  @Policy('operations or product admins ban users (sessions revoked, listings paused), audited', ['admin'])
  @Post('admin/users/:id/ban')
  async ban(@CurrentActor() a: RequestActor, @Param() p: IdDto, @Body() b: ReasonDto) {
    await this.scopes.require(a, ['operations', 'product']);
    return this.reports.ban(a, p.id, b.reason);
  }

  @Policy('operations or product admins lift bans, audited', ['admin'])
  @Post('admin/users/:id/unban')
  async unban(@CurrentActor() a: RequestActor, @Param() p: IdDto, @Body() b: ReasonDto) {
    await this.scopes.require(a, ['operations', 'product']);
    return this.reports.unban(a, p.id, b.reason);
  }

  @Policy('operations or product admins take down listings with a reason shown to the seller', ['admin'])
  @Post('admin/services/:id/takedown')
  async takedown(@CurrentActor() a: RequestActor, @Param() p: IdDto, @Body() b: ReasonDto) {
    await this.scopes.require(a, ['operations', 'product']);
    return this.reports.takedown(a, p.id, b.reason);
  }

  /** Admins may open ONLY files that were submitted as dispute evidence (a narrow, audited exception to owner-only files). */
  @Policy('operations or product admins open dispute evidence files', ['admin'])
  @Get('admin/disputes/evidence/:id/download')
  async evidenceFile(@CurrentActor() a: RequestActor, @Param() p: IdDto) {
    await this.scopes.require(a, ['operations', 'product']);
    const [row] = await this.db.db
      .select({ f: files })
      .from(disputeEvidence)
      .innerJoin(files, eq(files.id, disputeEvidence.fileId))
      .where(eq(disputeEvidence.id, p.id));
    if (!row || row.f.status !== 'clean') throw new NotFoundException('Evidence file not available');
    return {
      url: await this.storage.presignGet(row.f.storageKey, row.f.originalName),
      expiresInSeconds: 300,
    };
  }
}
