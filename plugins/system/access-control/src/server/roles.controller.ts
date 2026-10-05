import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Req } from "@nestjs/common";
import { PERMISSIONS, Permissions } from "@eops/security";
import type { AuthenticatedRequest } from "@eops/security";
import { CreateRoleDto, UpdateRoleDto } from "./dto/roles.dto";
import { RolesService } from "./roles.service";

@Controller("roles")
export class RolesController {
  constructor(private readonly service: RolesService) {}
  @Permissions(PERMISSIONS.roles.read) @Get() list() { return this.service.list(); }
  @Permissions(PERMISSIONS.roles.read) @Get(":id") get(@Param("id") id: string) { return this.service.findOne(id); }
  @Permissions(PERMISSIONS.roles.manage) @Post() create(@Body() dto: CreateRoleDto, @Req() request: AuthenticatedRequest) { return this.service.create(dto, request.user.id); }
  @Permissions(PERMISSIONS.roles.manage) @Patch(":id") update(@Param("id") id: string, @Body() dto: UpdateRoleDto, @Req() request: AuthenticatedRequest) { return this.service.update(id, dto, request.user.id); }
  @Permissions(PERMISSIONS.roles.manage) @Delete(":id") @HttpCode(204) remove(@Param("id") id: string, @Req() request: AuthenticatedRequest) { return this.service.remove(id, request.user.id); }
}
