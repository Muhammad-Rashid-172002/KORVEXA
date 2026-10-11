import { createOrderSchema, reasonSchema, revisionSchema, submitMilestoneSchema } from '@glasswork/shared';
import { Body, Controller, Get, Headers, Param, Post, Query } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import type { RequestActor } from '../../auth/session.service';
import { CurrentActor } from '../../common/policy/auth.guard';
import { Policy } from '../../common/policy/decorators';
import { IdempotencyService } from '../payments/idempotency.service';
import { PaymentsService } from '../payments/payments.service';
import { MilestonesService } from './milestones.service';
import { ProjectsService } from './projects.service';

class OrderDto extends createZodDto(createOrderSchema) {}
class IdDto extends createZodDto(z.object({ id: z.uuid() })) {}
class ListDto extends createZodDto(
  z.object({ cursor: z.uuid().optional(), limit: z.coerce.number().int().min(1).max(50).default(20) }),
) {}
class SubmitDto extends createZodDto(submitMilestoneSchema) {}
class RevisionDto extends createZodDto(revisionSchema) {}
class ReasonDto extends createZodDto(reasonSchema) {}

@ApiExcludeController()
@Controller()
export class OrdersController {
  constructor(
    private readonly projects: ProjectsService,
    private readonly milestones: MilestonesService,
    private readonly payments: PaymentsService,
    private readonly idem: IdempotencyService,
  ) {}

  @Policy('any signed-in user may order; amounts come from the DB, never the client')
  @Post('orders')
  async order(
    @CurrentActor() a: RequestActor,
    @Body() b: OrderDto,
    @Headers('idempotency-key') key: string | undefined,
  ) {
    const k = this.idem.requireKey(key);
    const { response } = await this.idem.run(
      { userId: a.userId, scope: 'order', key: k, body: b },
      async () => {
        const { project, milestones } = await this.projects.createFromOrder(a, b);
        return { projectId: project.id, code: project.code, firstMilestoneId: milestones[0]!.id };
      },
    );
    return response;
  }

  @Policy('lists only projects the caller participates in')
  @Get('projects')
  list(@CurrentActor() a: RequestActor, @Query() q: ListDto) {
    return this.projects.list(a, q.cursor, q.limit);
  }

  @Policy('project participants only; others get 404')
  @Get('projects/:id')
  get(@CurrentActor() a: RequestActor, @Param() p: IdDto) {
    return this.projects.view(a, p.id);
  }

  @Policy('only the project’s seller accepts, once the first milestone is funded')
  @Post('projects/:id/accept')
  accept(@CurrentActor() a: RequestActor, @Param() p: IdDto) {
    return this.milestones.acceptProject(a, p.id);
  }

  @Policy('the project’s seller declines or buyer withdraws an order awaiting acceptance (full refund)')
  @Post('projects/:id/decline')
  decline(@CurrentActor() a: RequestActor, @Param() p: IdDto, @Body() b: ReasonDto) {
    return this.milestones.declineProject(a, p.id, b.reason);
  }

  @Policy('only the project’s buyer funds a milestone; the amount is computed server-side')
  @Post('milestones/:id/fund')
  async fund(
    @CurrentActor() a: RequestActor,
    @Param() p: IdDto,
    @Headers('idempotency-key') key: string | undefined,
  ) {
    const k = this.idem.requireKey(key);
    const { response } = await this.idem.run(
      { userId: a.userId, scope: `fund:${p.id}`, key: k, body: null },
      () => this.payments.startFunding(a, p.id, k),
    );
    return response;
  }

  @Policy('only the project’s seller starts a funded milestone')
  @Post('milestones/:id/start')
  start(@CurrentActor() a: RequestActor, @Param() p: IdDto) {
    return this.milestones.start(a, p.id);
  }

  @Policy('only the project’s seller submits a milestone')
  @Post('milestones/:id/submit')
  submit(@CurrentActor() a: RequestActor, @Param() p: IdDto, @Body() b: SubmitDto) {
    return this.milestones.submit(a, p.id, b.note);
  }

  @Policy('only the project’s buyer requests a revision')
  @Post('milestones/:id/request-revision')
  revise(@CurrentActor() a: RequestActor, @Param() p: IdDto, @Body() b: RevisionDto) {
    return this.milestones.requestRevision(a, p.id, b.note);
  }

  @Policy('only the project’s buyer approves; approval releases the funds')
  @Post('milestones/:id/approve')
  approve(@CurrentActor() a: RequestActor, @Param() p: IdDto) {
    return this.milestones.approve(a, p.id);
  }
}
