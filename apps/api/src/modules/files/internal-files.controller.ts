import { auditLogs, eq, files, type DbClient } from '@glasswork/db';
import { scanResultSchema } from '@glasswork/shared';
import { Body, Controller, Headers, Inject, Logger, NotFoundException, Param, Post } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { requireInternalToken } from '../../common/internal-auth';
import { Public } from '../../common/policy/decorators';
import { ENV, type ApiEnv } from '../../config/env';
import { DB } from '../../infra/tokens';
import { StorageService } from './storage.service';

class ResultDto extends createZodDto(scanResultSchema) {}

/** Worker → API: the antivirus verdict. Only `uploaded` files can change state; infected objects are deleted. */
@ApiExcludeController()
@Controller('internal/files')
export class InternalFilesController {
  private readonly logger = new Logger(InternalFilesController.name);

  constructor(
    @Inject(DB) private readonly db: DbClient,
    @Inject(ENV) private readonly env: ApiEnv,
    private readonly storage: StorageService,
  ) {}

  @Public()
  @Post(':id/scan-result')
  async result(
    @Param('id') rawId: string,
    @Body() body: ResultDto,
    @Headers('x-internal-token') token: string | undefined,
  ) {
    requireInternalToken(token, this.env.INTERNAL_API_TOKEN);
    const id = z.uuid().parse(rawId);
    const [file] = await this.db.db.select().from(files).where(eq(files.id, id));
    if (!file) throw new NotFoundException();
    if (file.status !== 'uploaded') return { applied: false, status: file.status }; // idempotent: verdicts are final
    await this.db.db.update(files).set({ status: body.status }).where(eq(files.id, id));
    if (body.status === 'infected') {
      // Best effort: the verdict stands even if storage is unreachable (an infected file is never presigned anyway).
      await this.storage
        .delete(file.storageKey)
        .catch((err: unknown) => this.logger.warn(`could not delete infected object ${id}: ${String(err)}`));
    }
    await this.db.db.insert(auditLogs).values({
      actorId: null,
      action: `file.scan_${body.status}`,
      entityType: 'file',
      entityId: id,
      after: { signature: body.signature ?? null, ownerId: file.ownerId },
    });
    return { applied: true, status: body.status };
  }
}
