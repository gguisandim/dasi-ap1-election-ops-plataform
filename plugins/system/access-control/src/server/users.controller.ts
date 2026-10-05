import { Body, Controller, Delete, Get, Param, Patch, Post, Req } from "@nestjs/common";
import { PERMISSIONS, Permissions } from "@eops/security";
import type { AuthenticatedRequest } from "@eops/security";
import { AssignUserRolesDto, CreateUserDto, UpdateUserDto, UpdateUserStatusDto } from "./dto/auth.dto";
import { UsersService } from "./users.service";

@Controller("users")
export class UsersController {
  constructor(private readonly service: UsersService) {}
  @Permissions(PERMISSIONS.users.read) @Get() list() { return this.service.list(); }
  @Permissions(PERMISSIONS.users.read) @Get("roles") roles() { return this.service.roles(); }
  @Permissions(PERMISSIONS.users.read) @Get(":id") get(@Param("id") id: string) { return this.service.findOne(id); }
  @Permissions(PERMISSIONS.users.manage) @Post() create(@Body() dto: CreateUserDto, @Req() request: AuthenticatedRequest) { return this.service.create(dto, request.user.id); }
  @Permissions(PERMISSIONS.users.manage) @Patch(":id") update(@Param("id") id: string, @Body() dto: UpdateUserDto, @Req() request: AuthenticatedRequest) { return this.service.update(id, dto, request.user.id); }
  @Permissions(PERMISSIONS.users.manage) @Post(":id/roles") addRoles(@Param("id") id: string, @Body() dto: AssignUserRolesDto, @Req() request: AuthenticatedRequest) { return this.service.addRoles(id, dto.roleIds, request.user.id); }
  @Permissions(PERMISSIONS.users.manage) @Patch(":id/roles") replaceRoles(@Param("id") id: string, @Body() dto: AssignUserRolesDto, @Req() request: AuthenticatedRequest) { return this.service.replaceRoles(id, dto.roleIds, request.user.id); }
  @Permissions(PERMISSIONS.users.manage) @Delete(":id/roles/:roleId") removeRole(@Param("id") id: string, @Param("roleId") roleId: string, @Req() request: AuthenticatedRequest) { return this.service.removeRole(id, roleId, request.user.id); }
  @Permissions(PERMISSIONS.users.manage) @Patch(":id/status") updateStatus(@Param("id") id: string, @Body() dto: UpdateUserStatusDto, @Req() request: AuthenticatedRequest) { return this.service.updateStatus(id, dto.status, request.user.id); }
}
