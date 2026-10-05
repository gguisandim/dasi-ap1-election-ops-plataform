import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import { MemberAvailability } from "@prisma/client";
import type { AuthenticatedRequest } from "@eops/security";
import { PERMISSIONS, Permissions } from "@eops/security";
import {
  AvailabilityQueryDto,
  CreateAllocationDto,
  CreateCheckDto,
  CreateDispatchDto,
  CreateMemberDto,
  CreateRoleDto,
  CreateSpecialtyDto,
  CreateTeamDto,
  CreateUnavailabilityDto,
  DispatchQueryDto,
  FieldTeamsQueryDto,
  UpdateCatalogDto,
  UpdateDispatchStatusDto,
  UpdateMemberDto,
  UpdateTeamDto,
  UpdateUnavailabilityDto,
} from "./dto/field-teams.dto";
import { FieldDispatchService } from "./field-dispatch.service";
import { FieldTeamsService } from "./field-teams.service";

@Permissions(PERMISSIONS.fieldTeams.read)
@Controller("field-teams")
export class FieldTeamsController {
  constructor(
    private readonly service: FieldTeamsService,
    private readonly dispatchService: FieldDispatchService,
  ) {}
  @Get() teams(@Query() query: FieldTeamsQueryDto) {
    return this.service.findAll(query);
  }
  @Get("dashboard") async dashboard(@Query() query: FieldTeamsQueryDto) {
    const [dashboard, operations] = await Promise.all([
      this.service.dashboard(query),
      this.dispatchService.operationalMetrics(query.electionId),
    ]);
    return { ...dashboard, operations };
  }
  @Get("dispatches") dispatches(@Query() query: DispatchQueryDto) {
    return this.dispatchService.list(query);
  }
  @Get("dispatches/:id") dispatch(@Param("id") id: string) {
    return this.dispatchService.findOne(id);
  }
  @Permissions(PERMISSIONS.fieldTeams.manage)
  @Post("dispatches")
  createDispatch(
    @Body() dto: CreateDispatchDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.dispatchService.create(dto, request.user.id);
  }
  @Permissions(PERMISSIONS.fieldTeams.manage)
  @Patch("dispatches/:id/status")
  updateDispatchStatus(
    @Param("id") id: string,
    @Body() dto: UpdateDispatchStatusDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.dispatchService.transition(id, dto, request.user.id);
  }
  @Get("members") members(
    @Query("teamId") teamId?: string,
    @Query("status") status?: MemberAvailability,
  ) {
    return this.service.listMembers(teamId, status);
  }
  @Get("availability") availability(@Query() query: AvailabilityQueryDto) {
    return this.service.availability(query);
  }
  @Get("members/:id") member(@Param("id") id: string) {
    return this.service.findMember(id);
  }
  @Permissions(PERMISSIONS.fieldTeams.manage) @Post("members") createMember(
    @Body() dto: CreateMemberDto,
  ) {
    return this.service.createMember(dto);
  }
  @Permissions(PERMISSIONS.fieldTeams.manage)
  @Patch("members/:id")
  updateMember(
    @Param("id") id: string,
    @Body() dto: UpdateMemberDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.updateMember(id, dto, request.user.id);
  }
  @Permissions(PERMISSIONS.fieldTeams.manage)
  @Post("members/:id/unavailability")
  createUnavailability(
    @Param("id") id: string,
    @Body() dto: CreateUnavailabilityDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.createUnavailability(id, dto, request.user.id);
  }
  @Permissions(PERMISSIONS.fieldTeams.manage)
  @Patch("members/:id/unavailability/:periodId")
  updateUnavailability(
    @Param("id") id: string,
    @Param("periodId") periodId: string,
    @Body() dto: UpdateUnavailabilityDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.updateUnavailability(
      id,
      periodId,
      dto,
      request.user.id,
    );
  }
  @Permissions(PERMISSIONS.fieldTeams.manage)
  @Delete("members/:id/unavailability/:periodId")
  removeUnavailability(
    @Param("id") id: string,
    @Param("periodId") periodId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.removeUnavailability(id, periodId, request.user.id);
  }
  @Get("roles") roles() {
    return this.service.roles();
  }
  @Permissions(PERMISSIONS.fieldTeams.manage) @Post("roles") createRole(
    @Body() dto: CreateRoleDto,
  ) {
    return this.service.createRole(dto);
  }
  @Permissions(PERMISSIONS.fieldTeams.manage) @Patch("roles/:id") updateRole(
    @Param("id") id: string,
    @Body() dto: UpdateCatalogDto,
  ) {
    return this.service.updateRole(id, dto);
  }
  @Get("specialties") specialties() {
    return this.service.specialties();
  }
  @Permissions(PERMISSIONS.fieldTeams.manage)
  @Post("specialties")
  createSpecialty(@Body() dto: CreateSpecialtyDto) {
    return this.service.createSpecialty(dto);
  }
  @Permissions(PERMISSIONS.fieldTeams.manage)
  @Patch("specialties/:id")
  updateSpecialty(@Param("id") id: string, @Body() dto: UpdateCatalogDto) {
    return this.service.updateSpecialty(id, dto);
  }
  @Get("allocations") allocations(@Query() query: FieldTeamsQueryDto) {
    return this.service.allocations(query);
  }
  @Permissions(PERMISSIONS.fieldTeams.manage)
  @Post("allocations")
  createAllocation(
    @Body() dto: CreateAllocationDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.createAllocation(dto, request.user.id);
  }
  @Get("checks") checks(@Query() query: FieldTeamsQueryDto) {
    return this.service.checks(query);
  }
  @Permissions(PERMISSIONS.fieldTeams.manage) @Post("checks") createCheck(
    @Body() dto: CreateCheckDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.createCheck(dto, request.user.id);
  }
  @Get(":id/capabilities") capabilities(@Param("id") id: string) {
    return this.service.capabilities(id);
  }
  @Get(":id") team(@Param("id") id: string) {
    return this.service.findOne(id);
  }
  @Permissions(PERMISSIONS.fieldTeams.manage) @Post() createTeam(
    @Body() dto: CreateTeamDto,
  ) {
    return this.service.createTeam(dto);
  }
  @Permissions(PERMISSIONS.fieldTeams.manage) @Patch(":id") updateTeam(
    @Param("id") id: string,
    @Body() dto: UpdateTeamDto,
  ) {
    return this.service.updateTeam(id, dto);
  }
}
