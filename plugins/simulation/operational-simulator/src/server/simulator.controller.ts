import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Req } from "@nestjs/common";
import type { AuthenticatedRequest } from "@eops/security";
import { PERMISSIONS, Permissions } from "@eops/security";
import { CreateSimulationDto, CreateSimulationScenarioDto, SimulationScenarioEventInputDto, UpdateSimulationScenarioDto } from "./dto/simulation.dto";
import { SimulatorService } from "./simulator.service";

@Permissions(PERMISSIONS.simulation.read)
@Controller("simulations")
export class SimulatorController {
  constructor(private readonly service: SimulatorService) {}
  @Get() list() { return this.service.list(); }
  @Get("scenarios") scenarios() { return this.service.scenarios(); }
  @Get("scenarios/:id") getScenario(@Param("id") id: string) { return this.service.getScenario(id); }
  @Get(":id/report") report(@Param("id") id: string) { return this.service.report(id); }
  @Get(":id") get(@Param("id") id: string) { return this.service.get(id); }

  @Permissions(PERMISSIONS.simulation.manage)
  @Post()
  create(@Body() dto: CreateSimulationDto, @Req() request: AuthenticatedRequest) {
    return this.service.create(dto, request.user.id);
  }

  @Permissions(PERMISSIONS.simulation.manage) @Post("scenarios") createScenario(@Body() dto: CreateSimulationScenarioDto) { return this.service.createScenario(dto); }
  @Permissions(PERMISSIONS.simulation.manage) @Patch("scenarios/:id") updateScenario(@Param("id") id: string, @Body() dto: UpdateSimulationScenarioDto) { return this.service.updateScenario(id, dto); }
  @Permissions(PERMISSIONS.simulation.manage) @Delete("scenarios/:id") deleteScenario(@Param("id") id: string) { return this.service.deleteScenario(id); }
  @Permissions(PERMISSIONS.simulation.manage) @Post("scenarios/:id/events") addScenarioEvent(@Param("id") id: string, @Body() dto: SimulationScenarioEventInputDto) { return this.service.addScenarioEvent(id, dto); }
  @Permissions(PERMISSIONS.simulation.manage) @Post("scenarios/:id/events/:eventId/duplicate") duplicateScenarioEvent(@Param("id") id: string, @Param("eventId") eventId: string) { return this.service.duplicateScenarioEvent(id, eventId); }
  @Permissions(PERMISSIONS.simulation.manage) @Delete("scenarios/:id/events/:eventId") deleteScenarioEvent(@Param("id") id: string, @Param("eventId") eventId: string) { return this.service.deleteScenarioEvent(id, eventId); }

  @Permissions(PERMISSIONS.simulation.manage) @Post(":id/start") start(@Param("id") id: string, @Req() request: AuthenticatedRequest) { return this.service.start(id, request.user.id); }
  @Permissions(PERMISSIONS.simulation.manage) @Post(":id/pause") pause(@Param("id") id: string, @Req() request: AuthenticatedRequest) { return this.service.pause(id, request.user.id); }
  @Permissions(PERMISSIONS.simulation.manage) @Post(":id/tick") tick(@Param("id") id: string) { return this.service.tick(id); }
  @Permissions(PERMISSIONS.simulation.manage) @Post(":id/finish") @HttpCode(200) finish(@Param("id") id: string, @Req() request: AuthenticatedRequest) { return this.service.finish(id, request.user.id); }
}
