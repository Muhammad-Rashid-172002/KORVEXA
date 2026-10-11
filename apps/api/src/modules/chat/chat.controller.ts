import {
  markReadSchema,
  messagesQuerySchema,
  offerInputSchema,
  sendMessageSchema,
  startDirectSchema,
} from '@glasswork/shared';
import { Body, Controller, Get, Headers, Param, Post, Query } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import type { RequestActor } from '../../auth/session.service';
import { CurrentActor } from '../../common/policy/auth.guard';
import { Policy } from '../../common/policy/decorators';
import { IdempotencyService } from '../payments/idempotency.service';
import { ChatService } from './chat.service';

class IdDto extends createZodDto(z.object({ id: z.uuid() })) {}
class SendDto extends createZodDto(sendMessageSchema) {}
class PageDto extends createZodDto(messagesQuerySchema) {}
class DirectDto extends createZodDto(startDirectSchema) {}
class ReadDto extends createZodDto(markReadSchema) {}
class OfferDto extends createZodDto(offerInputSchema) {}

@ApiExcludeController()
@Controller()
export class ChatController {
  constructor(
    private readonly chat: ChatService,
    private readonly idem: IdempotencyService,
  ) {}

  @Policy('lists only conversations the caller is a member of')
  @Get('me/conversations')
  list(@CurrentActor() a: RequestActor) {
    return this.chat.list(a);
  }

  @Policy('only the project’s participants open its chat')
  @Get('projects/:id/chat')
  async projectChat(@CurrentActor() a: RequestActor, @Param() p: IdDto, @Query() q: PageDto) {
    const conversationId = await this.chat.projectConversation(a, p.id);
    return this.chat.page(a, conversationId, q.cursor, q.limit);
  }

  @Policy('a user may start a direct chat with a published seller (or, as a seller, with a buyer)')
  @Post('conversations/direct')
  async direct(@CurrentActor() a: RequestActor, @Body() b: DirectDto) {
    return { conversationId: await this.chat.directConversation(a, b.userId) };
  }

  @Policy('conversation members only; others get 404')
  @Get('conversations/:id/messages')
  messages(@CurrentActor() a: RequestActor, @Param() p: IdDto, @Query() q: PageDto) {
    return this.chat.page(a, p.id, q.cursor, q.limit);
  }

  @Policy('conversation members only; rate limited per user')
  @Post('conversations/:id/messages')
  send(@CurrentActor() a: RequestActor, @Param() p: IdDto, @Body() b: SendDto) {
    return this.chat.send(a, p.id, b);
  }

  @Policy('members record their own read position')
  @Post('conversations/:id/read')
  read(@CurrentActor() a: RequestActor, @Param() p: IdDto, @Body() b: ReadDto) {
    return this.chat.markRead(a, p.id, b.messageId);
  }

  @Policy('a published seller sends an offer in a direct conversation they belong to')
  @Post('conversations/:id/offers')
  offer(@CurrentActor() a: RequestActor, @Param() p: IdDto, @Body() b: OfferDto) {
    return this.chat.sendOffer(a, p.id, b);
  }

  @Policy('only the offer’s buyer accepts; creates the project')
  @Post('offers/:id/accept')
  async accept(
    @CurrentActor() a: RequestActor,
    @Param() p: IdDto,
    @Headers('idempotency-key') key: string | undefined,
  ) {
    const k = this.idem.requireKey(key);
    const { response } = await this.idem.run(
      { userId: a.userId, scope: `offer:${p.id}`, key: k, body: null },
      () => this.chat.acceptOffer(a, p.id),
    );
    return response;
  }

  @Policy('only the offer’s buyer declines')
  @Post('offers/:id/decline')
  decline(@CurrentActor() a: RequestActor, @Param() p: IdDto) {
    return this.chat.closeOffer(a, p.id, 'buyer');
  }

  @Policy('only the offer’s seller withdraws')
  @Post('offers/:id/withdraw')
  withdraw(@CurrentActor() a: RequestActor, @Param() p: IdDto) {
    return this.chat.closeOffer(a, p.id, 'seller');
  }
}
