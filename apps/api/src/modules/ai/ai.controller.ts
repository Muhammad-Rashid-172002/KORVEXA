import {
  briefSessionAnswersSchema,
  briefSessionStartSchema,
  confirmTasksSchema,
  gigHelperRequestSchema,
  editReportSchema,
  generateReportSchema,
  matchRequestSchema,
  meetingNotesSchema,
  structuredBriefSchema,
} from '@glasswork/shared';
import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import type { RequestActor } from '../../auth/session.service';
import { CurrentActor } from '../../common/policy/auth.guard';
import { Policy } from '../../common/policy/decorators';
import { AiService } from './ai.service';
import { AnalyticsService } from './analytics.service';
import { BriefBuilderService } from './brief-builder.service';
import { GigHelperService } from './gig-helper.service';
import { MatchingService } from './matching.service';
import { MeetingNotesService } from './meeting-notes.service';
import { ProgressReportsService } from './progress-reports.service';

class IdDto extends createZodDto(z.object({ id: z.uuid() })) {}
class StartDto extends createZodDto(briefSessionStartSchema) {}
class AnswersDto extends createZodDto(briefSessionAnswersSchema) {}
class PostBriefDto extends createZodDto(z.object({ brief: structuredBriefSchema.optional() })) {}
class MatchDto extends createZodDto(matchRequestSchema) {}
class GenerateDto extends createZodDto(generateReportSchema) {}
class EditReportDto extends createZodDto(editReportSchema) {}
class NotesDto extends createZodDto(meetingNotesSchema) {}
class GigHelperDto extends createZodDto(gigHelperRequestSchema) {}
class ConfirmDto extends createZodDto(confirmTasksSchema) {}

@ApiExcludeController()
@Controller()
export class AiController {
  constructor(
    private readonly ai: AiService,
    private readonly briefs: BriefBuilderService,
    private readonly matching: MatchingService,
    private readonly reports: ProgressReportsService,
    private readonly notes: MeetingNotesService,
    private readonly analytics: AnalyticsService,
    private readonly gigHelper: GigHelperService,
  ) {}

  @Policy(
    'any signed-in user; suggestions are not saved and count against the caller own AI rate limit and daily cap',
  )
  @Post('ai/gig-helper')
  gigHelp(@CurrentActor() a: RequestActor, @Body() b: GigHelperDto) {
    return this.gigHelper.help(a, b);
  }

  @Policy('any signed-in user may read their own AI allowance')
  @Get('ai/status')
  status(@CurrentActor() a: RequestActor) {
    return this.ai.status(a.userId);
  }

  // ---- brief builder: every session belongs to its creator (404 otherwise)
  @Policy('any signed-in user may start a brief; rate limited and capped per user')
  @Post('ai/brief-sessions')
  startBrief(@CurrentActor() a: RequestActor, @Body() b: StartDto) {
    return this.briefs.start(a, b.idea);
  }

  @Policy('only the creator of a brief session sees it')
  @Get('ai/brief-sessions')
  listBriefs(@CurrentActor() a: RequestActor) {
    return this.briefs.listMine(a);
  }

  @Policy('only the creator of a brief session sees it')
  @Get('ai/brief-sessions/:id')
  getBrief(@CurrentActor() a: RequestActor, @Param() p: IdDto) {
    return this.briefs.get(a, p.id);
  }

  @Policy('only the creator answers; rate limited and capped per user')
  @Post('ai/brief-sessions/:id/answers')
  answerBrief(@CurrentActor() a: RequestActor, @Param() p: IdDto, @Body() b: AnswersDto) {
    return this.briefs.answer(a, p.id, b.answers);
  }

  @Policy('only the creator posts their own brief as a request')
  @Post('ai/brief-sessions/:id/post')
  postBrief(@CurrentActor() a: RequestActor, @Param() p: IdDto, @Body() b: PostBriefDto) {
    return this.briefs.post(a, p.id, b.brief);
  }

  // ---- matching
  @Policy('any signed-in user; may only use their own requests as input; rate limited and capped')
  @Post('ai/match')
  match(@CurrentActor() a: RequestActor, @Body() b: MatchDto) {
    return this.matching.match(a, b);
  }

  // ---- progress reports: drafts are seller-only; buyers see sent reports only
  @Policy('only the project seller drafts reports; rate limited and capped')
  @Post('projects/:id/reports/generate')
  generateReport(@CurrentActor() a: RequestActor, @Param() p: IdDto, @Body() b: GenerateDto) {
    return this.reports.generateOnDemand(a, p.id, b.days);
  }

  @Policy('project participants; buyers only see reports the seller has sent')
  @Get('projects/:id/reports')
  listReports(@CurrentActor() a: RequestActor, @Param() p: IdDto) {
    return this.reports.list(a, p.id);
  }

  @Policy('only the seller edits a draft; sent reports are immutable')
  @Patch('reports/:id')
  editReport(@CurrentActor() a: RequestActor, @Param() p: IdDto, @Body() b: EditReportDto) {
    return this.reports.edit(a, p.id, b.content);
  }

  @Policy('only the seller sends a draft to the buyer')
  @Post('reports/:id/send')
  sendReport(@CurrentActor() a: RequestActor, @Param() p: IdDto) {
    return this.reports.send(a, p.id);
  }

  @Policy('only the seller discards their own draft')
  @Delete('reports/:id')
  discardReport(@CurrentActor() a: RequestActor, @Param() p: IdDto) {
    return this.reports.discard(a, p.id);
  }

  // ---- meeting notes → tasks: suggestions are not saved until the seller confirms
  @Policy('only the project seller; rate limited and capped')
  @Post('projects/:id/meeting-notes')
  proposeTasks(@CurrentActor() a: RequestActor, @Param() p: IdDto, @Body() b: NotesDto) {
    return this.notes.propose(a, p.id, b.notes);
  }

  @Policy('only the project seller creates tasks on the board')
  @Post('projects/:id/meeting-notes/tasks')
  confirmTasks(@CurrentActor() a: RequestActor, @Param() p: IdDto, @Body() b: ConfirmDto) {
    return this.notes.confirm(a, p.id, b);
  }

  // ---- analytics
  @Policy('a seller reads only their own numbers', ['seller'])
  @Get('me/analytics')
  myAnalytics(@CurrentActor() a: RequestActor) {
    return this.analytics.forSeller(a.userId);
  }
}
