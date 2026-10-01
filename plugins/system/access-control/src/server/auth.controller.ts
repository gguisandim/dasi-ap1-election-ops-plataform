import { Body, Controller, Get, HttpCode, Post, Req } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { Public } from "@eops/security";
import type { AuthenticatedRequest } from "@eops/security";
import { LoginDto } from "./dto/auth.dto";

@Controller("auth")
export class AuthController {
  constructor(private readonly service: AuthService) {}
  @Public() @Post("login") login(@Body() dto: LoginDto) { return this.service.login(dto); }
  @Get("me") me(@Req() request: AuthenticatedRequest) { return this.service.me(request.user.id); }
  @Post("logout") @HttpCode(204) logout(@Req() request: AuthenticatedRequest) { return this.service.logout(request.user.id); }
}
