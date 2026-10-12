import { codeLinkInputSchema } from '@glasswork/shared';
import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
  Req,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { FastifyRequest } from 'fastify';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import type { RequestActor } from '../../auth/session.service';
import { CurrentActor } from '../../common/policy/auth.guard';
import { Policy, Public } from '../../common/policy/decorators';
import { ENV, type ApiEnv } from '../../config/env';
import { CodeActivityService } from './code-activity.service';

class IdDto extends createZodDto(z.object({ id: z.uuid() })) {}
class LinkParamDto extends createZodDto(z.object({ id: z.uuid(), linkId: z.uuid() })) {}
class LinkDto extends createZodDto(codeLinkInputSchema) {}
class PageDto extends createZodDto(
  z.object({ cursor: z.uuid().optional(), limit: z.coerce.number().int().min(1).max(50).default(20) }),
) {}

@ApiExcludeController()
@Controller()
export class CodeActivityController {
  constructor(private readonly code: CodeActivityService) {}

  @Policy('project participants see connected repositories')
  @Get('projects/:id/code-links')
  links(@CurrentActor() a: RequestActor, @Param() p: IdDto) {
    return this.code.links(a, p.id);
  }

  @Policy('only the project seller connects a repository')
  @Post('projects/:id/code-links')
  link(@CurrentActor() a: RequestActor, @Param() p: IdDto, @Body() b: LinkDto) {
    return this.code.link(a, p.id, b.repo);
  }

  @Policy('only the project seller disconnects a repository')
  @Delete('projects/:id/code-links/:linkId')
  unlink(@CurrentActor() a: RequestActor, @Param() p: LinkParamDto) {
    return this.code.unlink(a, p.id, p.linkId);
  }

  @Policy('project participants read the plain-language code activity')
  @Get('projects/:id/code-activity')
  activity(@CurrentActor() a: RequestActor, @Param() p: IdDto, @Query() q: PageDto) {
    return this.code.activity(a, p.id, q.cursor, q.limit);
  }
}

/** GitHub → us. Authenticated only by the HMAC signature of the raw body, never by a session. */
@ApiExcludeController()
@Controller('webhooks')
export class GithubWebhookController {
  constructor(
    private readonly code: CodeActivityService,
    @Inject(ENV) private readonly env: ApiEnv,
  ) {}

  @Public()
  @Post('github')
  @HttpCode(200)
  async receive(
    @Req() req: FastifyRequest & { rawBody?: Buffer },
    @Headers('x-hub-signature-256') signature: string | undefined,
    @Headers('x-github-event') event: string | undefined,
    @Headers('x-github-delivery') delivery: string | undefined,
  ) {
    const secret = this.env.GITHUB_WEBHOOK_SECRET;
    if (!secret) throw new ServiceUnavailableException('The GitHub integration is not configured');
    const raw = req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
    const expected = `sha256=${createHmac('sha256', secret).update(raw).digest('hex')}`;
    const a = Buffer.from(expected);
    const b = Buffer.from(signature ?? '');
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new UnauthorizedException('Bad signature');
    if (!event || !delivery) return { stored: 0 };
    return this.code.ingest(event, delivery, req.body);
  }
}
