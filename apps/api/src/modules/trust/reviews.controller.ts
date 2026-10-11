import { eq, profiles, sellerProfiles, type DbClient } from '@glasswork/db';
import {
  finalReviewSchema,
  milestoneFeedbackSchema,
  reviewReplySchema,
  reviewsQuerySchema,
  SELLER_LEVELS,
} from '@glasswork/shared';
import { Body, Controller, Get, Inject, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import type { RequestActor } from '../../auth/session.service';
import { CurrentActor } from '../../common/policy/auth.guard';
import { Policy, Public } from '../../common/policy/decorators';
import { DB } from '../../infra/tokens';
import { ReviewsService } from './reviews.service';
import { SellerStatsService } from './stats.service';

class IdDto extends createZodDto(z.object({ id: z.uuid() })) {}
class SlugDto extends createZodDto(z.object({ slug: z.string().min(1).max(60) })) {}
class FinalDto extends createZodDto(finalReviewSchema) {}
class FeedbackDto extends createZodDto(milestoneFeedbackSchema) {}
class ReplyDto extends createZodDto(reviewReplySchema) {}
class PageDto extends createZodDto(reviewsQuerySchema) {}

@ApiExcludeController()
@Controller()
export class ReviewsController {
  constructor(
    private readonly reviews: ReviewsService,
    private readonly stats: SellerStatsService,
    @Inject(DB) private readonly db: DbClient,
  ) {}

  @Policy('only the paying buyer leaves private feedback on a paid milestone')
  @Post('milestones/:id/feedback')
  feedback(@CurrentActor() a: RequestActor, @Param() p: IdDto, @Body() b: FeedbackDto) {
    return this.reviews.milestoneFeedback(a, p.id, b);
  }

  @Policy('only the paying buyer of a completed project leaves the public review, once')
  @Post('projects/:id/review')
  review(@CurrentActor() a: RequestActor, @Param() p: IdDto, @Body() b: FinalDto) {
    return this.reviews.finalReview(a, p.id, b);
  }

  @Policy('project participants see review state; sellers see private feedback they received')
  @Get('projects/:id/reviews')
  forProject(@CurrentActor() a: RequestActor, @Param() p: IdDto) {
    return this.reviews.forProject(a, p.id);
  }

  @Policy('only the reviewed seller replies, once, to public reviews')
  @Post('reviews/:id/reply')
  reply(@CurrentActor() a: RequestActor, @Param() p: IdDto, @Body() b: ReplyDto) {
    return this.reviews.reply(a, p.id, b.body);
  }

  @Public()
  @Get('profiles/:slug/reviews')
  async publicReviews(@Param() p: SlugDto, @Query() q: PageDto) {
    const [row] = await this.db.db
      .select({ userId: profiles.userId, done: sellerProfiles.onboardingCompletedAt })
      .from(profiles)
      .innerJoin(sellerProfiles, eq(sellerProfiles.userId, profiles.userId))
      .where(eq(profiles.slug, p.slug.toLowerCase()));
    if (!row?.done) throw new NotFoundException('Profile not found');
    return {
      stats: await this.stats.one(row.userId),
      ...(await this.reviews.listPublic(row.userId, q.cursor, q.limit)),
    };
  }

  /** The published level criteria (transparent, brief §9). */
  @Public()
  @Get('seller-levels')
  levels() {
    return SELLER_LEVELS;
  }
}
