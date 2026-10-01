import { Body, Controller, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { MemberAvailability } from "@prisma/client";
import type { AuthenticatedRequest } from "@eops/security";
import { PERMISSIONS, Permissions } from "@eops/security";
import { CreateAllocationDto, CreateCheckDto, CreateMemberDto, CreateRoleDto, CreateShiftDto, CreateSpecialtyDto, CreateTeamDto, FieldTeamsQueryDto, UpdateCatalogDto, UpdateMemberDto, UpdateTeamDto } from "./dto/field-teams.dto";
import { FieldTeamsService } from "./field-teams.service";

@Permissions(PERMISSIONS.fieldTeams.read)
@Controller("field-teams")
export class FieldTeamsController {
  constructor(private readonly service: FieldTeamsService) {}
  @Get() teams(@Query() query: FieldTeamsQueryDto) { return this.service.findAll(query); }
  @Get("dashboard") dashboard(@Query() query: FieldTeamsQueryDto) { return this.service.dashboard(query); }
  @Get("members") members(@Query("teamId") teamId?: string, @Query("status") status?: MemberAvailability) { return this.service.listMembers(teamId, status); }
  @Permissions(PERMISSIONS.fieldTeams.manage) @Post("members") createMember(@Body() dto: CreateMemberDto) { return this.service.createMember(dto); }
  @Permissions(PERMISSIONS.fieldTeams.manage) @Patch("members/:id") updateMember(@Param("id") id: string, @Body() dto: UpdateMemberDto) { return this.service.updateMember(id, dto); }
  @Get("roles") roles() { return this.service.roles(); }
  @Permissions(PERMISSIONS.fieldTeams.manage) @Post("roles") createRole(@Body() dto: CreateRoleDto) { return this.service.createRole(dto); }
  @Permissions(PERMISSIONS.fieldTeams.manage) @Patch("roles/:id") updateRole(@Param("id") id: string, @Body() dto: UpdateCatalogDto) { return this.service.updateRole(id, dto); }
  @Get("specialties") specialties() { return this.service.specialties(); }
  @Permissions(PERMISSIONS.fieldTeams.manage) @Post("specialties") createSpecialty(@Body() dto: CreateSpecialtyDto) { return this.service.createSpecialty(dto); }
  @Permissions(PERMISSIONS.fieldTeams.manage) @Patch("specialties/:id") updateSpecialty(@Param("id") id: string, @Body() dto: UpdateCatalogDto) { return this.service.updateSpecialty(id, dto); }
  @Get("shifts") shifts(@Query() query: FieldTeamsQueryDto) { return this.service.shifts(query); }
  @Permissions(PERMISSIONS.fieldTeams.manage) @Post("shifts") createShift(@Body() dto: CreateShiftDto) { return this.service.createShift(dto); }
  @Get("allocations") allocations(@Query() query: FieldTeamsQueryDto) { return this.service.allocations(query); }
  @Permissions(PERMISSIONS.fieldTeams.manage) @Post("allocations") createAllocation(@Body() dto: CreateAllocationDto, @Req() request: AuthenticatedRequest) { return this.service.createAllocation(dto, request.user.id); }
  @Get("checks") checks(@Query() query: FieldTeamsQueryDto) { return this.service.checks(query); }
  @Permissions(PERMISSIONS.fieldTeams.manage) @Post("checks") createCheck(@Body() dto: CreateCheckDto, @Req() request: AuthenticatedRequest) { return this.service.createCheck(dto, request.user.id); }
  @Get(":id") team(@Param("id") id: string) { return this.service.findOne(id); }
  @Permissions(PERMISSIONS.fieldTeams.manage) @Post() createTeam(@Body() dto: CreateTeamDto) { return this.service.createTeam(dto); }
  @Permissions(PERMISSIONS.fieldTeams.manage) @Patch(":id") updateTeam(@Param("id") id: string, @Body() dto: UpdateTeamDto) { return this.service.updateTeam(id, dto); }
}
