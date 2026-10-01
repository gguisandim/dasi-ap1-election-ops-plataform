import { Body, Controller, Get, HttpCode, Param, Post, Req } from "@nestjs/common";
import type { AuthenticatedRequest } from "@eops/security";
import { PERMISSIONS, Permissions } from "@eops/security";
import { CreateSimulationDto } from "./dto/simulation.dto";
import { SimulatorService } from "./simulator.service";

@Permissions(PERMISSIONS.simulation.read)
@Controller("simulations")
export class SimulatorController {
  constructor(private readonly service: SimulatorService) {}
  @Get() list() { return this.service.list(); }
  @Get("scenarios") scenarios() { return this.service.scenarios(); }
  @Get(":id") get(@Param("id") id: string) { return this.service.get(id); }

  @Permissions(PERMISSIONS.simulation.manage)
  @Post()
  create(@Body() dto: CreateSimulationDto, @Req() request: AuthenticatedRequest) {
    return this.service.create(dto, request.user.id);
  }

  @Permissions(PERMISSIONS.simulation.manage) @Post(":id/start") start(@Param("id") id: string) { return this.service.start(id); }
  @Permissions(PERMISSIONS.simulation.manage) @Post(":id/pause") pause(@Param("id") id: string) { return this.service.pause(id); }
  @Permissions(PERMISSIONS.simulation.manage) @Post(":id/tick") tick(@Param("id") id: string) { return this.service.tick(id); }
  @Permissions(PERMISSIONS.simulation.manage) @Post(":id/finish") @HttpCode(200) finish(@Param("id") id: string) { return this.service.finish(id); }
}
