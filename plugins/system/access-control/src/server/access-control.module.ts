import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { EventBusModule } from "@eops/event-bus";
import { AuthController } from "./auth.controller";
import { AuthenticationGuard, PermissionGuard } from "./auth.guards";
import { AuthService } from "./auth.service";
import { PermissionsController } from "./permissions.controller";
import { RolesController } from "./roles.controller";
import { RolesService } from "./roles.service";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";

@Module({
  imports: [EventBusModule],
  controllers: [AuthController, UsersController, RolesController, PermissionsController],
  providers: [
    AuthService, UsersService, RolesService, AuthenticationGuard, PermissionGuard,
    { provide: APP_GUARD, useExisting: AuthenticationGuard },
    { provide: APP_GUARD, useExisting: PermissionGuard },
  ],
  exports: [AuthService, UsersService, RolesService],
})
export class AccessControlModule {}
