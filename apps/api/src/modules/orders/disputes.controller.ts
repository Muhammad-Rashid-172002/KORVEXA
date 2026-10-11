import {
  adminDisputesQuerySchema,
  evidenceInputSchema,
  openDisputeSchema,
  resolveDisputeSchema,
} from '@glasswork/shared';
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import type { RequestActor } from '../../auth/session.service';
import { AdminScopeService } from '../../common/policy/admin-scope.service';
import { CurrentActor } from '../../common/policy/auth.guard';
import { Policy } from '../../common/policy/decorators';
import { DisputesService } from './disputes.service';
import { MilestonesService } from './milestones.service';

class IdDto extends createZodDto(z.object({ id: z.uuid() })) {}
class OpenDto extends createZodDto(openDisputeSchema) {}
class EvidenceDto extends createZodDto(evidenceInputSchema) {}
class ResolveDto extends createZodDto(resolveDisputeSchema) {}
class AdminQueryDto extends createZodDto(adminDisputesQuerySchema) {}

@ApiExcludeController()
@Controller()
export class DisputesController {
  constructor(
    private readonly disputes: DisputesService,
    private readonly milestones: MilestonesService,
    private readonly scopes: AdminScopeService,
  ) {}

  @Policy('either project party opens a dispute on a funded, unfinished milestone')
  @Post('milestones/:id/dispute')
  open(@CurrentActor() a: RequestActor, @Param() p: IdDto, @Body() b: OpenDto) {
    return this.disputes.open(a, p.id, b.reason);
  }

  @Policy('project participants read the project’s disputes')
  @Get('projects/:id/disputes')
  forProject(@CurrentActor() a: RequestActor, @Param() p: IdDto) {
    return this.disputes.forProject(a, p.id);
  }

  @Policy('project participants read a dispute and its case file; others get 404')
  @Get('disputes/:id')
  get(@CurrentActor() a: RequestActor, @Param() p: IdDto) {
    return this.disputes.get(a, p.id);
  }

  @Policy('project participants add evidence to an unresolved dispute')
  @Post('disputes/:id/evidence')
  evidence(@CurrentActor() a: RequestActor, @Param() p: IdDto, @Body() b: EvidenceDto) {
    return this.disputes.addEvidence(a, p.id, b);
  }

  @Policy('admin role required to see the dispute queue', ['admin'])
  @Get('admin/disputes')
  adminList(@Query() q: AdminQueryDto) {
    return this.disputes.adminList(q.status);
  }

  @Policy('admin role required to read a dispute case file', ['admin'])
  @Get('admin/disputes/:id')
  adminGet(@Param() p: IdDto) {
    return this.disputes.adminGet(p.id);
  }

  @Policy('operations or product admins take a dispute under review', ['admin'])
  @Post('admin/disputes/:id/review')
  async review(@CurrentActor() a: RequestActor, @Param() p: IdDto) {
    await this.scopes.require(a, ['operations', 'product']);
    return this.disputes.startReview(a, p.id);
  }

  @Policy('operations or product admins resolve a dispute (release / refund / split), audited', ['admin'])
  @Post('admin/disputes/:id/resolve')
  async resolve(@CurrentActor() a: RequestActor, @Param() p: IdDto, @Body() b: ResolveDto) {
    await this.scopes.require(a, ['operations', 'product']);
    return this.milestones.resolveDispute(a, p.id, b);
  }
}
