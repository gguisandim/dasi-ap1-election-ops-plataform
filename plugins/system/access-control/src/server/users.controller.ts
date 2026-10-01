import { Body, Controller, Get, Param, Patch, Post, Req } from "@nestjs/common";
import { Permissions } from "./auth.decorators";
import type { AuthenticatedRequest } from "./auth.types";
import { CreateUserDto, UpdateUserDto } from "./dto/auth.dto";
import { UsersService } from "./users.service";

@Controller("users")
export class UsersController {
  constructor(private readonly service: UsersService) {}
  @Permissions("users.read") @Get() list() { return this.service.list(); }
  @Permissions("users.read") @Get("roles") roles() { return this.service.roles(); }
  @Permissions("users.read") @Get(":id") get(@Param("id") id: string) { return this.service.findOne(id); }
  @Permissions("users.manage") @Post() create(@Body() dto: CreateUserDto, @Req() request: AuthenticatedRequest) { return this.service.create(dto, request.user.id); }
  @Permissions("users.manage") @Patch(":id") update(@Param("id") id: string, @Body() dto: UpdateUserDto, @Req() request: AuthenticatedRequest) { return this.service.update(id, dto, request.user.id); }
}
