import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { AuthController } from "./auth.controller";
import { AuthenticationGuard, PermissionGuard } from "./auth.guards";
import { AuthService } from "./auth.service";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";

@Module({
  controllers: [AuthController, UsersController],
  providers: [
    AuthService, UsersService, AuthenticationGuard, PermissionGuard,
    { provide: APP_GUARD, useExisting: AuthenticationGuard },
    { provide: APP_GUARD, useExisting: PermissionGuard },
  ],
  exports: [AuthService, UsersService],
})
export class AccessControlModule {}
