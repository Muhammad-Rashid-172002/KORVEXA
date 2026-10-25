import { Body, Controller, Get, Post, Res } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import type { FastifyReply } from 'fastify';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import type { RequestActor } from '../../auth/session.service';
import { CurrentActor } from '../../common/policy/auth.guard';
import { Policy } from '../../common/policy/decorators';
import { AccountService } from './account.service';

class DeleteAccountDto extends createZodDto(z.object({ confirmEmail: z.string().min(3).max(320) })) {}

@ApiTags('me')
@ApiCookieAuth()
@Controller('me')
export class AccountController {
  constructor(private readonly account: AccountService) {}

  @Policy('a user downloads only their own data')
  @Get('export')
  async export(@CurrentActor() actor: RequestActor, @Res() res: FastifyReply) {
    const data = await this.account.export(actor);
    await res
      .header('content-type', 'application/json')
      .header('content-disposition', 'attachment; filename="glasswork-data-export.json"')
      .header('cache-control', 'private, no-store')
      .send(JSON.stringify(data, null, 2));
  }

  @Policy('a user checks what blocks deleting their own account')
  @Get('delete-check')
  async check(@CurrentActor() actor: RequestActor) {
    const reasons = await this.account.blockers(actor);
    return { canDelete: reasons.length === 0, reasons };
  }

  @Policy('a user deletes only their own account, after typing their email')
  @Post('delete')
  async remove(@CurrentActor() actor: RequestActor, @Body() b: DeleteAccountDto) {
    await this.account.deleteAccount(actor, b.confirmEmail);
    return { ok: true };
  }
}
