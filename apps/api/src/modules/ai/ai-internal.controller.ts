import { Controller, Headers, Inject, Post } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { requireInternalToken } from '../../common/internal-auth';
import { Public } from '../../common/policy/decorators';
import { ENV, type ApiEnv } from '../../config/env';
import { ProgressReportsService } from './progress-reports.service';

/** Worker → API callback for the weekly report schedule. Authenticated by the shared internal token. */
@ApiExcludeController()
@Controller('internal/reports')
export class AiInternalController {
  constructor(
    private readonly reports: ProgressReportsService,
    @Inject(ENV) private readonly env: ApiEnv,
  ) {}

  @Public()
  @Post('weekly')
  weekly(@Headers('x-internal-token') token: string | undefined) {
    requireInternalToken(token, this.env.INTERNAL_API_TOKEN);
    return this.reports.weekly();
  }
}
