import { Controller, Get, Query, Req } from "@nestjs/common";
import type { AuthenticatedRequest } from "@eops/security";
import { PERMISSIONS, Permissions } from "@eops/security";
import { OperationalMapQueryDto } from "./dto/operational-map.dto";
import { OperationalMapService } from "./operational-map.service";

@Permissions(PERMISSIONS.elections.read)
@Controller("operational-map")
export class OperationalMapController {
  constructor(private readonly service: OperationalMapService) {}

  @Get("features")
  features(@Query() query: OperationalMapQueryDto, @Req() request: AuthenticatedRequest) {
    return this.service.features(query, request.user.permissions);
  }
}
