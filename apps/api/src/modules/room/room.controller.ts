import {
  commentInputSchema,
  deliverableInputSchema,
  eventsQuerySchema,
  feedbackInputSchema,
  previewInputSchema,
  taskInputSchema,
  taskPatchSchema,
} from '@glasswork/shared';
import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import type { RequestActor } from '../../auth/session.service';
import { CurrentActor } from '../../common/policy/auth.guard';
import { Policy } from '../../common/policy/decorators';
import { RoomService } from './room.service';

const id = z.uuid();
class ProjectParam extends createZodDto(z.object({ id })) {}
class TaskParam extends createZodDto(z.object({ id, taskId: id })) {}
class PreviewParam extends createZodDto(z.object({ id, previewId: id })) {}
class MilestoneParam extends createZodDto(z.object({ id })) {}
class DeliverableParam extends createZodDto(z.object({ id })) {}
class FeedbackParam extends createZodDto(z.object({ id })) {}
class TaskDto extends createZodDto(taskInputSchema) {}
class TaskPatchDto extends createZodDto(taskPatchSchema) {}
class CommentDto extends createZodDto(commentInputSchema) {}
class DeliverableDto extends createZodDto(deliverableInputSchema) {}
class FeedbackDto extends createZodDto(feedbackInputSchema) {}
class ResolveDto extends createZodDto(z.object({ resolved: z.boolean() })) {}
class PreviewDto extends createZodDto(previewInputSchema) {}
class EventsDto extends createZodDto(eventsQuerySchema) {}

/** Live Project Room: every route is participant-scoped (404 otherwise); mutations are seller-only except comments/feedback. */
@ApiExcludeController()
@Controller()
export class RoomController {
  constructor(private readonly room: RoomService) {}

  @Policy('project participants read the board')
  @Get('projects/:id/board')
  board(@CurrentActor() a: RequestActor, @Param() p: ProjectParam) {
    return this.room.board(a, p.id);
  }

  @Policy('only the project seller creates tasks')
  @Post('projects/:id/tasks')
  createTask(@CurrentActor() a: RequestActor, @Param() p: ProjectParam, @Body() b: TaskDto) {
    return this.room.createTask(a, p.id, b);
  }

  @Policy('only the project seller edits or moves tasks')
  @Patch('projects/:id/tasks/:taskId')
  updateTask(@CurrentActor() a: RequestActor, @Param() p: TaskParam, @Body() b: TaskPatchDto) {
    return this.room.updateTask(a, p.id, p.taskId, b);
  }

  @Policy('only the project seller deletes tasks')
  @Delete('projects/:id/tasks/:taskId')
  deleteTask(@CurrentActor() a: RequestActor, @Param() p: TaskParam) {
    return this.room.deleteTask(a, p.id, p.taskId);
  }

  @Policy('project participants read task comments')
  @Get('projects/:id/tasks/:taskId/comments')
  comments(@CurrentActor() a: RequestActor, @Param() p: TaskParam) {
    return this.room.listComments(a, p.id, p.taskId);
  }

  @Policy('project participants (buyer and seller) comment on tasks')
  @Post('projects/:id/tasks/:taskId/comments')
  comment(@CurrentActor() a: RequestActor, @Param() p: TaskParam, @Body() b: CommentDto) {
    return this.room.addComment(a, p.id, p.taskId, b.body);
  }

  @Policy('project participants read deliverables')
  @Get('projects/:id/deliverables')
  deliverables(@CurrentActor() a: RequestActor, @Param() p: ProjectParam) {
    return this.room.listDeliverables(a, p.id);
  }

  @Policy('only the project seller uploads a new deliverable version')
  @Post('milestones/:id/deliverables')
  addDeliverable(@CurrentActor() a: RequestActor, @Param() p: MilestoneParam, @Body() b: DeliverableDto) {
    return this.room.addDeliverable(a, p.id, b);
  }

  @Policy('project participants download scanned deliverables via a presigned URL')
  @Get('deliverables/:id/download')
  download(@CurrentActor() a: RequestActor, @Param() p: DeliverableParam) {
    return this.room.downloadDeliverable(a, p.id);
  }

  @Policy('project participants pin feedback to a deliverable')
  @Post('deliverables/:id/feedback')
  feedback(@CurrentActor() a: RequestActor, @Param() p: DeliverableParam, @Body() b: FeedbackDto) {
    return this.room.addFeedback(a, p.id, b);
  }

  @Policy('project participants resolve or reopen feedback')
  @Put('deliverable-feedback/:id/resolved')
  resolve(@CurrentActor() a: RequestActor, @Param() p: FeedbackParam, @Body() b: ResolveDto) {
    return this.room.setFeedbackResolved(a, p.id, b.resolved);
  }

  @Policy('project participants read preview links')
  @Get('projects/:id/previews')
  previews(@CurrentActor() a: RequestActor, @Param() p: ProjectParam) {
    return this.room.listPreviews(a, p.id);
  }

  @Policy('only the project seller adds preview links (https only)')
  @Post('projects/:id/previews')
  addPreview(@CurrentActor() a: RequestActor, @Param() p: ProjectParam, @Body() b: PreviewDto) {
    return this.room.savePreview(a, p.id, b);
  }

  @Policy('only the project seller edits preview links')
  @Put('projects/:id/previews/:previewId')
  updatePreview(@CurrentActor() a: RequestActor, @Param() p: PreviewParam, @Body() b: PreviewDto) {
    return this.room.savePreview(a, p.id, b, p.previewId);
  }

  @Policy('only the project seller removes preview links')
  @Delete('projects/:id/previews/:previewId')
  deletePreview(@CurrentActor() a: RequestActor, @Param() p: PreviewParam) {
    return this.room.deletePreview(a, p.id, p.previewId);
  }

  @Policy('project participants read the activity feed')
  @Get('projects/:id/events')
  events(@CurrentActor() a: RequestActor, @Param() p: ProjectParam, @Query() q: EventsDto) {
    return this.room.events(a, p.id, q.filter, q.cursor, q.limit);
  }
}
