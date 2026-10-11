import { verificationDecisionSchema, verificationRequestSchema } from '@glasswork/shared';
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import type { RequestActor } from '../../auth/session.service';
import { AdminScopeService } from '../../common/policy/admin-scope.service';
import { CurrentActor } from '../../common/policy/auth.guard';
import { Policy } from '../../common/policy/decorators';
import { VerificationsService } from './verifications.service';

class RequestDto extends createZodDto(verificationRequestSchema) {}
class DecisionDto extends createZodDto(verificationDecisionSchema) {}
class IdDto extends createZodDto(z.object({ id: z.uuid() })) {}
class QueueDto extends createZodDto(
  z.object({ status: z.enum(['pending', 'verified', 'rejected']).default('pending') }),
) {}

@ApiExcludeController()
@Controller()
export class VerificationsController {
  constructor(
    private readonly verifications: VerificationsService,
    private readonly scopes: AdminScopeService,
  ) {}

  @Policy('a seller reads only their own verification status', ['seller'])
  @Get('me/verifications')
  mine(@CurrentActor() a: RequestActor) {
    return this.verifications.mine(a);
  }

  @Policy('a seller requests badges only for themselves', ['seller'])
  @Post('me/verifications')
  request(@CurrentActor() a: RequestActor, @Body() b: RequestDto) {
    return this.verifications.request(a, b);
  }

  @Policy('admin role required to see the verification queue', ['admin'])
  @Get('admin/verifications')
  queue(@Query() q: QueueDto) {
    return this.verifications.queue(q.status);
  }

  @Policy('admin role required to open a seller’s evidence document', ['admin'])
  @Get('admin/verifications/:id/evidence')
  async evidence(@CurrentActor() a: RequestActor, @Param() p: IdDto) {
    await this.scopes.require(a, ['operations', 'product']);
    return this.verifications.evidenceUrl(p.id);
  }

  @Policy('operations or product admins decide verifications', ['admin'])
  @Post('admin/verifications/:id/decision')
  async decide(@CurrentActor() a: RequestActor, @Param() p: IdDto, @Body() b: DecisionDto) {
    await this.scopes.require(a, ['operations', 'product']);
    return this.verifications.decide(a, p.id, b.decision, b.note);
  }
}
