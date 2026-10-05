import { Controller, Get } from "@nestjs/common";
import { PERMISSIONS, Permissions } from "@eops/security";
import { RolesService } from "./roles.service";

@Controller("permissions")
export class PermissionsController {
  constructor(private readonly service: RolesService) {}
  @Permissions(PERMISSIONS.roles.read) @Get() catalog() { return this.service.catalog(); }
}
