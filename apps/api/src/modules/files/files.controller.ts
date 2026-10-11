import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { ApiCookieAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import type { RequestActor } from '../../auth/session.service';
import { CurrentActor } from '../../common/policy/auth.guard';
import { Policy } from '../../common/policy/decorators';
import {
  FileDto,
  FileIdParamDto,
  FilePageDto,
  FileWithUrlDto,
  ListFilesQueryDto,
  PresignUploadDto,
  PresignUploadResponseDto,
} from './files.dto';
import { FilesService } from './files.service';

@ApiTags('files')
@ApiCookieAuth()
@Controller()
export class FilesController {
  constructor(private readonly files: FilesService) {}

  @Policy('any signed-in user may upload; the file is owned by them')
  @Post('files/uploads')
  @ApiCreatedResponse({ type: PresignUploadResponseDto })
  presign(@CurrentActor() actor: RequestActor, @Body() body: PresignUploadDto) {
    return this.files.presignUpload(actor, body);
  }

  @Policy('only the owner may complete their upload')
  @Post('files/:id/complete')
  @ApiOkResponse({ type: FileDto })
  complete(@CurrentActor() actor: RequestActor, @Param() p: FileIdParamDto, @Req() req: FastifyRequest) {
    return this.files.completeUpload(actor, p.id, req.ip);
  }

  /** Presigned download for any file the caller may read: their own, or one delivered/attached in a project or chat they belong to. */
  @Policy(
    'owner, project participants (deliverables) or conversation members (attachments) — clean files only',
  )
  @Get('files/:id/download')
  download(@CurrentActor() actor: RequestActor, @Param() p: FileIdParamDto) {
    return this.files.downloadReadable(actor, p.id);
  }

  @Policy('list only files owned by the signed-in user')
  @Get('me/files')
  @ApiOkResponse({ type: FilePageDto })
  list(@CurrentActor() actor: RequestActor, @Query() q: ListFilesQueryDto) {
    return this.files.listOwned(actor, q);
  }

  /** The Phase 0 protected endpoint with a policy test: owner → 200, other user → 404, anonymous → 401. */
  @Policy('only the owner may read a file or get its download URL')
  @Get('me/files/:id')
  @ApiOkResponse({ type: FileWithUrlDto })
  get(@CurrentActor() actor: RequestActor, @Param() p: FileIdParamDto) {
    return this.files.getOwned(actor, p.id);
  }
}
