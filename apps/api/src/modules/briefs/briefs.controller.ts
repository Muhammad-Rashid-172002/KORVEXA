import { briefInputSchema, briefListQuerySchema, proposalInputSchema } from '@glasswork/shared';
import { Body, Controller, Get, Headers, Param, Post, Query } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import type { RequestActor } from '../../auth/session.service';
import { CurrentActor } from '../../common/policy/auth.guard';
import { Policy } from '../../common/policy/decorators';
import { IdempotencyService } from '../payments/idempotency.service';
import { BriefsService } from './briefs.service';

class BriefDto extends createZodDto(briefInputSchema) {}
class ProposalDto extends createZodDto(proposalInputSchema) {}
class ListDto extends createZodDto(briefListQuerySchema) {}
class IdDto extends createZodDto(z.object({ id: z.uuid() })) {}

@ApiExcludeController()
@Controller()
export class BriefsController {
  constructor(
    private readonly briefs: BriefsService,
    private readonly idem: IdempotencyService,
  ) {}

  @Policy('any signed-in user may post a request; it is owned by the caller')
  @Post('briefs')
  create(@CurrentActor() a: RequestActor, @Body() b: BriefDto) {
    return this.briefs.create(a, b);
  }

  @Policy('published sellers browse open requests')
  @Get('briefs')
  board(@CurrentActor() a: RequestActor, @Query() q: ListDto) {
    return this.briefs.board(a, q.q, q.cursor, q.limit);
  }

  @Policy('lists only the caller’s own requests')
  @Get('me/briefs')
  mine(@CurrentActor() a: RequestActor) {
    return this.briefs.listMine(a);
  }

  @Policy('the owner, or a published seller while the request is open; others get 404')
  @Get('briefs/:id')
  get(@CurrentActor() a: RequestActor, @Param() p: IdDto) {
    return this.briefs.view(a, p.id);
  }

  @Policy('only the owner closes a request')
  @Post('briefs/:id/close')
  close(@CurrentActor() a: RequestActor, @Param() p: IdDto) {
    return this.briefs.close(a, p.id);
  }

  @Policy('only published sellers propose, on open requests they do not own')
  @Post('briefs/:id/proposals')
  propose(@CurrentActor() a: RequestActor, @Param() p: IdDto, @Body() b: ProposalDto) {
    return this.briefs.propose(a, p.id, b);
  }

  @Policy('lists only the caller’s own proposals')
  @Get('me/proposals')
  myProposals(@CurrentActor() a: RequestActor) {
    return this.briefs.listMyProposals(a);
  }

  @Policy('only the proposing seller withdraws')
  @Post('proposals/:id/withdraw')
  withdraw(@CurrentActor() a: RequestActor, @Param() p: IdDto) {
    return this.briefs.withdraw(a, p.id);
  }

  @Policy('only the request’s owner declines a proposal')
  @Post('proposals/:id/decline')
  decline(@CurrentActor() a: RequestActor, @Param() p: IdDto) {
    return this.briefs.decline(a, p.id);
  }

  @Policy('only the request’s owner accepts a proposal; creates the project')
  @Post('proposals/:id/accept')
  async accept(
    @CurrentActor() a: RequestActor,
    @Param() p: IdDto,
    @Headers('idempotency-key') key: string | undefined,
  ) {
    const k = this.idem.requireKey(key);
    const { response } = await this.idem.run(
      { userId: a.userId, scope: `accept:${p.id}`, key: k, body: null },
      () => this.briefs.accept(a, p.id),
    );
    return response;
  }
}
