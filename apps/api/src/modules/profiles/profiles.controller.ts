import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import {
  portfolioItemInputSchema,
  setAvatarSchema,
  setModeSchema,
  setSkillsSchema,
  updateOnboardingSchema,
  updateProfileSchema,
  updateSellerSchema,
} from '@glasswork/shared';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import type { RequestActor } from '../../auth/session.service';
import { CurrentActor } from '../../common/policy/auth.guard';
import { Policy, Public } from '../../common/policy/decorators';
import { ProfilesService } from './profiles.service';

class SetModeDto extends createZodDto(setModeSchema) {}
class UpdateOnboardingDto extends createZodDto(updateOnboardingSchema) {}
class UpdateProfileDto extends createZodDto(updateProfileSchema) {}
class SetAvatarDto extends createZodDto(setAvatarSchema) {}
class UpdateSellerDto extends createZodDto(updateSellerSchema) {}
class SetSkillsDto extends createZodDto(setSkillsSchema) {}
class PortfolioItemDto extends createZodDto(portfolioItemInputSchema) {}
class ItemParamDto extends createZodDto(z.object({ itemId: z.uuid() })) {}
class SlugParamDto extends createZodDto(z.object({ slug: z.string().min(1).max(60) })) {}
class SkillQueryDto extends createZodDto(z.object({ q: z.string().max(40).optional() })) {}

@ApiTags('profiles')
@ApiCookieAuth()
@Controller()
export class ProfilesController {
  constructor(private readonly profiles: ProfilesService) {}

  @Policy('a user switches only their own active mode; seller mode requires the seller role')
  @Patch('me/mode')
  setMode(@CurrentActor() a: RequestActor, @Body() b: SetModeDto) {
    return this.profiles.setMode(a, b);
  }

  @Policy('a user opts only themselves into selling')
  @Post('me/seller')
  becomeSeller(@CurrentActor() a: RequestActor) {
    return this.profiles.becomeSeller(a);
  }

  @Policy('a user reads only their own profile (including unpublished seller data)')
  @Get('me/profile')
  getOwn(@CurrentActor() a: RequestActor) {
    return this.profiles.getOwn(a);
  }

  @Policy('a user reads only their own first-run state')
  @Get('me/onboarding')
  getOnboarding(@CurrentActor() a: RequestActor) {
    return this.profiles.getOnboarding(a);
  }

  @Policy('a user changes only their own first-run state')
  @Patch('me/onboarding')
  updateOnboarding(@CurrentActor() a: RequestActor, @Body() b: UpdateOnboardingDto) {
    return this.profiles.updateOnboarding(a, b);
  }

  @Policy('a user edits only their own profile')
  @Patch('me/profile')
  update(@CurrentActor() a: RequestActor, @Body() b: UpdateProfileDto) {
    return this.profiles.updateOwn(a, b);
  }

  @Policy('avatar must be a completed avatar upload owned by the caller')
  @Put('me/profile/avatar')
  avatar(@CurrentActor() a: RequestActor, @Body() b: SetAvatarDto) {
    return this.profiles.setAvatar(a, b.fileId);
  }

  @Policy('a seller edits only their own seller settings')
  @Patch('me/seller')
  updateSeller(@CurrentActor() a: RequestActor, @Body() b: UpdateSellerDto) {
    return this.profiles.updateSeller(a, b);
  }

  @Policy('a seller replaces only their own skills')
  @Put('me/seller/skills')
  setSkills(@CurrentActor() a: RequestActor, @Body() b: SetSkillsDto) {
    return this.profiles.setSkills(a, b.skills);
  }

  @Policy('a seller adds portfolio items only to their own profile')
  @Post('me/seller/portfolio')
  addItem(@CurrentActor() a: RequestActor, @Body() b: PortfolioItemDto) {
    return this.profiles.addPortfolio(a, b);
  }

  @Policy('a seller edits only their own portfolio items')
  @Put('me/seller/portfolio/:itemId')
  updateItem(@CurrentActor() a: RequestActor, @Param() p: ItemParamDto, @Body() b: PortfolioItemDto) {
    return this.profiles.updatePortfolio(a, p.itemId, b);
  }

  @Policy('a seller deletes only their own portfolio items')
  @Delete('me/seller/portfolio/:itemId')
  deleteItem(@CurrentActor() a: RequestActor, @Param() p: ItemParamDto) {
    return this.profiles.deletePortfolio(a, p.itemId);
  }

  @Policy('a seller reads only their own onboarding progress')
  @Get('me/seller/onboarding')
  onboarding(@CurrentActor() a: RequestActor) {
    return this.profiles.onboarding(a);
  }

  @Policy('a seller publishes only their own profile once required steps are done')
  @Post('me/seller/onboarding/complete')
  complete(@CurrentActor() a: RequestActor) {
    return this.profiles.completeOnboarding(a);
  }

  @Policy('any signed-in user may search the shared skills list')
  @Get('skills')
  skills(@Query() q: SkillQueryDto) {
    return this.profiles.searchSkills(q.q);
  }

  @Public()
  @Get('profiles/:slug')
  publicProfile(@Param() p: SlugParamDto) {
    return this.profiles.getPublic(p.slug);
  }
}
