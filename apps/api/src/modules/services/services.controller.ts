import { savedSearchInputSchema, serviceInputSchema, serviceSearchSchema } from '@glasswork/shared';
import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import type { RequestActor } from '../../auth/session.service';
import { CurrentActor } from '../../common/policy/auth.guard';
import { Policy, Public } from '../../common/policy/decorators';
import { ServicesService } from './services.service';

class ServiceInputDto extends createZodDto(serviceInputSchema) {}
class SearchDto extends createZodDto(serviceSearchSchema) {}
class SavedSearchDto extends createZodDto(savedSearchInputSchema) {}
class IdParamDto extends createZodDto(z.object({ id: z.uuid() })) {}
class SlugParamDto extends createZodDto(z.object({ slug: z.string().min(1).max(120) })) {}

@ApiTags('services')
@Controller()
export class ServicesController {
  constructor(private readonly services: ServicesService) {}

  // ---- public discovery ----
  @Public()
  @Get('categories')
  categories() {
    return this.services.listCategories();
  }

  @Public()
  @Get('services')
  search(@Query() q: SearchDto) {
    return this.services.searchPublic(q);
  }

  @Public()
  @Get('services/:slug')
  detail(@Param() p: SlugParamDto) {
    return this.services.getPublic(p.slug);
  }

  // ---- seller ----
  @ApiCookieAuth()
  @Policy('a seller lists only their own services (any status)')
  @Get('me/services')
  mine(@CurrentActor() a: RequestActor) {
    return this.services.listMine(a);
  }

  @ApiCookieAuth()
  @Policy('only sellers create services; they are owned by the caller')
  @Post('me/services')
  create(@CurrentActor() a: RequestActor, @Body() b: ServiceInputDto) {
    return this.services.create(a, b);
  }

  @ApiCookieAuth()
  @Policy('a seller reads only their own service (any status); others get 404')
  @Get('me/services/:id')
  getMine(@CurrentActor() a: RequestActor, @Param() p: IdParamDto) {
    return this.services.getMine(a, p.id);
  }

  @ApiCookieAuth()
  @Policy('a seller edits only their own service; live edits return to review')
  @Put('me/services/:id')
  update(@CurrentActor() a: RequestActor, @Param() p: IdParamDto, @Body() b: ServiceInputDto) {
    return this.services.update(a, p.id, b);
  }

  @ApiCookieAuth()
  @Policy('a seller submits only their own draft/rejected service for review')
  @Post('me/services/:id/submit')
  submit(@CurrentActor() a: RequestActor, @Param() p: IdParamDto) {
    return this.services.transition(a, p.id, 'submit');
  }

  @ApiCookieAuth()
  @Policy('a seller pauses only their own live service')
  @Post('me/services/:id/pause')
  pause(@CurrentActor() a: RequestActor, @Param() p: IdParamDto) {
    return this.services.transition(a, p.id, 'pause');
  }

  @ApiCookieAuth()
  @Policy('a seller resumes only their own paused service')
  @Post('me/services/:id/resume')
  resume(@CurrentActor() a: RequestActor, @Param() p: IdParamDto) {
    return this.services.transition(a, p.id, 'resume');
  }

  @ApiCookieAuth()
  @Policy('a seller deletes only their own non-live service')
  @Delete('me/services/:id')
  remove(@CurrentActor() a: RequestActor, @Param() p: IdParamDto) {
    return this.services.deleteMine(a, p.id);
  }

  // ---- favorites ----
  @ApiCookieAuth()
  @Policy('favorites belong to the caller; only live services can be saved')
  @Post('services/:id/favorite')
  favorite(@CurrentActor() a: RequestActor, @Param() p: IdParamDto) {
    return this.services.addFavorite(a, p.id);
  }

  @ApiCookieAuth()
  @Policy('removes only the caller’s own favorite')
  @Delete('services/:id/favorite')
  unfavorite(@CurrentActor() a: RequestActor, @Param() p: IdParamDto) {
    return this.services.removeFavorite(a, p.id);
  }

  @ApiCookieAuth()
  @Policy('lists only the caller’s favorites')
  @Get('me/favorites')
  favorites(@CurrentActor() a: RequestActor) {
    return this.services.listFavorites(a);
  }

  @ApiCookieAuth()
  @Policy('lists only the caller’s favorite ids')
  @Get('me/favorites/ids')
  favoriteIds(@CurrentActor() a: RequestActor) {
    return this.services.favoriteIds(a);
  }

  // ---- saved searches ----
  @ApiCookieAuth()
  @Policy('lists only the caller’s saved searches')
  @Get('me/saved-searches')
  savedSearches(@CurrentActor() a: RequestActor) {
    return this.services.listSavedSearches(a);
  }

  @ApiCookieAuth()
  @Policy('saved searches belong to the caller')
  @Post('me/saved-searches')
  saveSearch(@CurrentActor() a: RequestActor, @Body() b: SavedSearchDto) {
    return this.services.saveSearch(a, b);
  }

  @ApiCookieAuth()
  @Policy('deletes only the caller’s own saved search')
  @Delete('me/saved-searches/:id')
  deleteSavedSearch(@CurrentActor() a: RequestActor, @Param() p: IdParamDto) {
    return this.services.deleteSavedSearch(a, p.id);
  }
}
