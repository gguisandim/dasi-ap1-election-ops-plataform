import { Body, Controller, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { PERMISSIONS, Permissions, type AuthenticatedRequest } from "@eops/security";
import { CreateShiftAssignmentDto, CreateShiftDto, RegisterAbsenceDto, ReplaceAssignmentDto, ShiftsQueryDto, UpdateShiftDto } from "./dto/shifts.dto";
import { ShiftsService } from "./shifts.service";

@Permissions(PERMISSIONS.shifts.read)
@Controller("shifts")
export class ShiftsController {
  constructor(private readonly service: ShiftsService) {}

  @Get("references") references() { return this.service.references(); }
  @Get("dashboard") dashboard(@Query() query: ShiftsQueryDto) { return this.service.dashboard(query); }
  @Get() shifts(@Query() query: ShiftsQueryDto) { return this.service.shifts(query); }
  @Get(":id") shift(@Param("id") id: string) { return this.service.findOne(id); }

  @Permissions(PERMISSIONS.shifts.manage)
  @Post()
  create(@Body() dto: CreateShiftDto, @Req() request: AuthenticatedRequest) { return this.service.createShift(dto, request.user.id); }

  @Permissions(PERMISSIONS.shifts.manage)
  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateShiftDto, @Req() request: AuthenticatedRequest) { return this.service.updateShift(id, dto, request.user.id); }

  @Permissions(PERMISSIONS.shifts.manage)
  @Post(":id/assignments")
  assign(@Param("id") id: string, @Body() dto: CreateShiftAssignmentDto, @Req() request: AuthenticatedRequest) { return this.service.createAssignment(id, dto, request.user.id); }

  @Permissions(PERMISSIONS.shifts.manage)
  @Post(":id/assignments/:assignmentId/presence")
  presence(@Param("id") id: string, @Param("assignmentId") assignmentId: string, @Req() request: AuthenticatedRequest) { return this.service.registerPresence(id, assignmentId, request.user.id); }

  @Permissions(PERMISSIONS.shifts.manage)
  @Post(":id/assignments/:assignmentId/absence")
  absence(@Param("id") id: string, @Param("assignmentId") assignmentId: string, @Body() dto: RegisterAbsenceDto, @Req() request: AuthenticatedRequest) { return this.service.registerAbsence(id, assignmentId, dto.reason, request.user.id); }

  @Permissions(PERMISSIONS.shifts.manage)
  @Post(":id/assignments/:assignmentId/on-call/activate")
  activateOnCall(@Param("id") id: string, @Param("assignmentId") assignmentId: string, @Req() request: AuthenticatedRequest) { return this.service.activateOnCall(id, assignmentId, request.user.id); }

  @Permissions(PERMISSIONS.shifts.manage)
  @Post(":id/assignments/:assignmentId/replace")
  replace(@Param("id") id: string, @Param("assignmentId") assignmentId: string, @Body() dto: ReplaceAssignmentDto, @Req() request: AuthenticatedRequest) { return this.service.replaceAssignment(id, assignmentId, dto, request.user.id); }

  @Permissions(PERMISSIONS.shifts.manage)
  @Post(":id/start")
  start(@Param("id") id: string, @Req() request: AuthenticatedRequest) { return this.service.changeStatus(id, "IN_PROGRESS", request.user.id); }

  @Permissions(PERMISSIONS.shifts.manage)
  @Post(":id/complete")
  complete(@Param("id") id: string, @Req() request: AuthenticatedRequest) { return this.service.changeStatus(id, "COMPLETED", request.user.id); }

  @Permissions(PERMISSIONS.shifts.manage)
  @Post(":id/cancel")
  cancel(@Param("id") id: string, @Req() request: AuthenticatedRequest) { return this.service.changeStatus(id, "CANCELLED", request.user.id); }
}
