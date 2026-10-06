import { Body, Controller, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { PERMISSIONS, Permissions, type AuthenticatedRequest } from "@eops/security";
import {
  CancelHandoverDto,
  CreateHandoverDto,
  HandoverContextQueryDto,
  HandoverQueryDto,
  UpdateHandoverDto,
} from "./dto/shift-handovers.dto";
import { ShiftHandoversService } from "./shift-handovers.service";

@Permissions(PERMISSIONS.shiftHandovers.read)
@Controller("shift-handovers")
export class ShiftHandoversController {
  constructor(private readonly service: ShiftHandoversService) {}

  @Get("dashboard") dashboard(@Req() request: AuthenticatedRequest) {
    return this.service.dashboard(request.user.id);
  }

  @Get("context") context(@Query() query: HandoverContextQueryDto) {
    return this.service.context(query.shiftId);
  }

  @Get() list(@Query() query: HandoverQueryDto) {
    return this.service.list(query);
  }

  @Get(":id") detail(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.service.findOne(id, request.user.id, request.user.permissions);
  }

  @Permissions(PERMISSIONS.shiftHandovers.manage)
  @Post() create(@Body() dto: CreateHandoverDto, @Req() request: AuthenticatedRequest) {
    return this.service.create(dto, request.user.id, request.user.permissions);
  }

  @Permissions(PERMISSIONS.shiftHandovers.manage)
  @Patch(":id") update(@Param("id") id: string, @Body() dto: UpdateHandoverDto, @Req() request: AuthenticatedRequest) {
    return this.service.update(id, dto, request.user.id, request.user.permissions);
  }

  @Permissions(PERMISSIONS.shiftHandovers.manage)
  @Post(":id/submit") submit(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.service.submit(id, request.user.id, request.user.permissions);
  }

  @Permissions(PERMISSIONS.shiftHandovers.confirm)
  @Post(":id/confirm") confirm(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.service.confirm(id, request.user.id, request.user.permissions);
  }

  @Permissions(PERMISSIONS.shiftHandovers.manage)
  @Post(":id/cancel") cancel(@Param("id") id: string, @Body() dto: CancelHandoverDto, @Req() request: AuthenticatedRequest) {
    return this.service.cancel(id, dto.reason, request.user.id, request.user.permissions);
  }
}
