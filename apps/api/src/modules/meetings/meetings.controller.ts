import { consentSchema, meetingInputSchema, meetingNotesInputSchema } from '@glasswork/shared';
import { Body, Controller, Get, Param, Post, Put, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { FastifyReply } from 'fastify';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import type { RequestActor } from '../../auth/session.service';
import { CurrentActor } from '../../common/policy/auth.guard';
import { Policy } from '../../common/policy/decorators';
import { MeetingsService } from './meetings.service';

class IdDto extends createZodDto(z.object({ id: z.uuid() })) {}
class MeetingDto extends createZodDto(meetingInputSchema) {}
class ConsentDto extends createZodDto(consentSchema) {}
class NotesDto extends createZodDto(meetingNotesInputSchema) {}

@ApiExcludeController()
@Controller()
export class MeetingsController {
  constructor(private readonly meetings: MeetingsService) {}

  @Policy('project participants (buyer or seller side) schedule; everyone else gets 404')
  @Post('projects/:id/meetings')
  schedule(@CurrentActor() a: RequestActor, @Param() p: IdDto, @Body() b: MeetingDto) {
    return this.meetings.schedule(a, p.id, b);
  }

  @Policy('project participants list their project’s meetings')
  @Get('projects/:id/meetings')
  list(@CurrentActor() a: RequestActor, @Param() p: IdDto) {
    return this.meetings.list(a, p.id);
  }

  @Policy('project participants only; others get 404')
  @Get('meetings/:id')
  get(@CurrentActor() a: RequestActor, @Param() p: IdDto) {
    return this.meetings.get(a, p.id);
  }

  @Policy('each participant answers the recording question for themselves only')
  @Put('meetings/:id/consent')
  consent(@CurrentActor() a: RequestActor, @Param() p: IdDto, @Body() b: ConsentDto) {
    return this.meetings.consent(a, p.id, b.consent);
  }

  @Policy('project participants join inside the join window; recording only if all consented')
  @Post('meetings/:id/join')
  join(@CurrentActor() a: RequestActor, @Param() p: IdDto) {
    return this.meetings.join(a, p.id);
  }

  @Policy('only the organizer cancels')
  @Post('meetings/:id/cancel')
  cancel(@CurrentActor() a: RequestActor, @Param() p: IdDto) {
    return this.meetings.cancel(a, p.id);
  }

  @Policy('project participants mark a meeting as ended')
  @Post('meetings/:id/end')
  end(@CurrentActor() a: RequestActor, @Param() p: IdDto) {
    return this.meetings.end(a, p.id);
  }

  @Policy('project participants keep shared meeting notes')
  @Put('meetings/:id/notes')
  notes(@CurrentActor() a: RequestActor, @Param() p: IdDto, @Body() b: NotesDto) {
    return this.meetings.setNotes(a, p.id, b.notes);
  }

  @Policy('project participants download the calendar invite (it lists attendee emails)')
  @Get('meetings/:id/ics')
  async ics(
    @CurrentActor() a: RequestActor,
    @Param() p: IdDto,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    // Headers are set only after the access check succeeded, so error responses stay JSON.
    const body = await this.meetings.ics(a, p.id);
    void reply.header('content-type', 'text/calendar; charset=utf-8');
    void reply.header('content-disposition', 'attachment; filename="glasswork-meeting.ics"');
    return body;
  }
}
