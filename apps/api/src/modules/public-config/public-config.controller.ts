import { brand } from '@glasswork/shared';
import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ENV, isOAuthEnabled, type ApiEnv } from '../../config/env';
import { Public } from '../../common/policy/decorators';

const publicConfigSchema = z.object({
  productName: z.string(),
  oauth: z.object({ google: z.boolean(), github: z.boolean() }),
});
class PublicConfigDto extends createZodDto(publicConfigSchema) {}

/** Non-secret runtime config the web app needs (e.g. which OAuth buttons to show). */
@ApiTags('config')
@Controller('config')
export class PublicConfigController {
  constructor(@Inject(ENV) private readonly env: ApiEnv) {}

  @Public()
  @Get('public')
  @ApiOkResponse({ type: PublicConfigDto })
  get(): PublicConfigDto {
    return { productName: brand.productName, oauth: isOAuthEnabled(this.env) };
  }
}
