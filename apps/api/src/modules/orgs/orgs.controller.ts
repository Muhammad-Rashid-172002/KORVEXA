import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { acceptInviteSchema, createOrgSchema, inviteSchema, updateMemberRoleSchema } from '@glasswork/shared';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import type { RequestActor } from '../../auth/session.service';
import { CurrentActor } from '../../common/policy/auth.guard';
import { Policy } from '../../common/policy/decorators';
import { OrgsService } from './orgs.service';

class CreateOrgDto extends createZodDto(createOrgSchema) {}
class InviteDto extends createZodDto(inviteSchema) {}
class AcceptDto extends createZodDto(acceptInviteSchema) {}
class RoleDto extends createZodDto(updateMemberRoleSchema) {}
class OrgParamDto extends createZodDto(z.object({ orgId: z.uuid() })) {}
class OrgInviteParamDto extends createZodDto(z.object({ orgId: z.uuid(), inviteId: z.uuid() })) {}
class OrgMemberParamDto extends createZodDto(z.object({ orgId: z.uuid(), userId: z.uuid() })) {}

@ApiTags('orgs')
@ApiCookieAuth()
@Controller()
export class OrgsController {
  constructor(private readonly orgs: OrgsService) {}

  @Policy('any signed-in user may create an organization and becomes its owner')
  @Post('orgs')
  create(@CurrentActor() a: RequestActor, @Body() b: CreateOrgDto) {
    return this.orgs.create(a, b);
  }

  @Policy('lists only organizations the caller belongs to')
  @Get('orgs')
  list(@CurrentActor() a: RequestActor) {
    return this.orgs.listMine(a);
  }

  @Policy('org members only; others get 404')
  @Get('orgs/:orgId')
  get(@CurrentActor() a: RequestActor, @Param() p: OrgParamDto) {
    return this.orgs.get(a, p.orgId);
  }

  @Policy('org owners/admins invite; others 403, non-members 404')
  @Post('orgs/:orgId/invites')
  invite(@CurrentActor() a: RequestActor, @Param() p: OrgParamDto, @Body() b: InviteDto) {
    return this.orgs.invite(a, p.orgId, b);
  }

  @Policy('org owners/admins revoke invites')
  @Delete('orgs/:orgId/invites/:inviteId')
  revoke(@CurrentActor() a: RequestActor, @Param() p: OrgInviteParamDto) {
    return this.orgs.revokeInvite(a, p.orgId, p.inviteId);
  }

  @Policy('only the invited, verified email address can accept')
  @Post('invites/accept')
  accept(@CurrentActor() a: RequestActor, @Body() b: AcceptDto) {
    return this.orgs.accept(a, b.token);
  }

  @Policy('only the org owner changes member roles')
  @Patch('orgs/:orgId/members/:userId')
  setRole(@CurrentActor() a: RequestActor, @Param() p: OrgMemberParamDto, @Body() b: RoleDto) {
    return this.orgs.setRole(a, p.orgId, p.userId, b.role);
  }

  @Policy('owners/admins remove members; any member may leave (not the owner)')
  @Delete('orgs/:orgId/members/:userId')
  remove(@CurrentActor() a: RequestActor, @Param() p: OrgMemberParamDto) {
    return this.orgs.removeMember(a, p.orgId, p.userId);
  }
}
