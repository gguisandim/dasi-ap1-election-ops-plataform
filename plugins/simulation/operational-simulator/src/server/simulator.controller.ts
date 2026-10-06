import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, Req } from "@nestjs/common";
import type { AuthenticatedRequest } from "@eops/security";
import { PERMISSIONS, Permissions } from "@eops/security";
import { CloneSimulationScenarioDto, CompareSimulationsDto, CreateSimulationDto, CreateSimulationScenarioDto, FailSimulationDto, RecordDecisionDto, SimulationScenarioEventInputDto, UpdateScenarioEventDto, UpdateSimulationScenarioDto } from "./dto/simulation.dto";
import { SimulatorService } from "./simulator.service";

interface RunQuery { electionId?: string; status?: string; scenarioId?: string; page?: string; pageSize?: string }
interface ScenarioQuery { status?: string; isTemplate?: string }

@Permissions(PERMISSIONS.simulation.read)
@Controller("simulations")
export class SimulatorController {
  constructor(private readonly service: SimulatorService) {}

  @Get() list(@Query() query: RunQuery) { return this.service.list(query); }
  @Get("runs") runs(@Query() query: RunQuery) {
    return this.service.runs({ electionId: query.electionId, status: query.status, scenarioId: query.scenarioId, page: query.page ? Number(query.page) : undefined, pageSize: query.pageSize ? Number(query.pageSize) : undefined });
  }
  @Get("scenarios") scenarios(@Query() query: ScenarioQuery) {
    return this.service.scenarios({ status: query.status, isTemplate: query.isTemplate === undefined ? undefined : query.isTemplate === "true" });
  }
  @Get("scenarios/:id") getScenario(@Param("id") id: string) { return this.service.getScenario(id); }
  @Get(":id/report") report(@Param("id") id: string) { return this.service.report(id); }
  @Get(":id/replay") replay(@Param("id") id: string) { return this.service.replay(id); }
  @Get(":id/replay/frame") replayFrame(@Param("id") id: string, @Query("offsetSeconds") offsetSeconds?: string) { return this.service.replayFrame(id, Number(offsetSeconds ?? 0)); }
  @Get(":id/decisions") decisions(@Param("id") id: string) { return this.service.decisions(id); }
  @Get(":id") get(@Param("id") id: string) { return this.service.detail(id); }

  @Permissions(PERMISSIONS.simulation.manage)
  @Post()
  create(@Body() dto: CreateSimulationDto, @Req() request: AuthenticatedRequest) { return this.service.create(dto, request.user.id); }

  @Permissions(PERMISSIONS.simulation.manage) @Post("compare") @HttpCode(200) compare(@Body() dto: CompareSimulationsDto) { return this.service.compare(dto.simulationIds); }

  @Permissions(PERMISSIONS.simulation.manage) @Post("scenarios") createScenario(@Body() dto: CreateSimulationScenarioDto) { return this.service.createScenario(dto); }
  @Permissions(PERMISSIONS.simulation.manage) @Patch("scenarios/:id") updateScenario(@Param("id") id: string, @Body() dto: UpdateSimulationScenarioDto) { return this.service.updateScenario(id, dto); }
  @Permissions(PERMISSIONS.simulation.manage) @Delete("scenarios/:id") deleteScenario(@Param("id") id: string) { return this.service.deleteScenario(id); }
  @Permissions(PERMISSIONS.simulation.manage) @Post("scenarios/:id/clone") cloneScenario(@Param("id") id: string, @Body() dto: CloneSimulationScenarioDto) { return this.service.cloneScenario(id, dto); }
  @Permissions(PERMISSIONS.simulation.manage) @Post("scenarios/:id/publish") publishScenario(@Param("id") id: string) { return this.service.publishScenario(id); }
  @Permissions(PERMISSIONS.simulation.manage) @Post("scenarios/:id/archive") archiveScenario(@Param("id") id: string) { return this.service.archiveScenario(id); }
  @Permissions(PERMISSIONS.simulation.manage) @Post("scenarios/:id/events") addScenarioEvent(@Param("id") id: string, @Body() dto: SimulationScenarioEventInputDto) { return this.service.addScenarioEvent(id, dto); }
  @Permissions(PERMISSIONS.simulation.manage) @Patch("scenarios/:id/events/:eventId") updateScenarioEvent(@Param("id") id: string, @Param("eventId") eventId: string, @Body() dto: UpdateScenarioEventDto) { return this.service.updateScenarioEvent(id, eventId, dto); }
  @Permissions(PERMISSIONS.simulation.manage) @Post("scenarios/:id/events/:eventId/duplicate") duplicateScenarioEvent(@Param("id") id: string, @Param("eventId") eventId: string) { return this.service.duplicateScenarioEvent(id, eventId); }
  @Permissions(PERMISSIONS.simulation.manage) @Delete("scenarios/:id/events/:eventId") deleteScenarioEvent(@Param("id") id: string, @Param("eventId") eventId: string) { return this.service.deleteScenarioEvent(id, eventId); }

  @Permissions(PERMISSIONS.simulation.manage) @Post(":id/start") start(@Param("id") id: string, @Req() request: AuthenticatedRequest) { return this.service.start(id, request.user.id); }
  @Permissions(PERMISSIONS.simulation.manage) @Post(":id/pause") pause(@Param("id") id: string, @Req() request: AuthenticatedRequest) { return this.service.pause(id, request.user.id); }
  @Permissions(PERMISSIONS.simulation.manage) @Post(":id/tick") tick(@Param("id") id: string) { return this.service.tick(id); }
  @Permissions(PERMISSIONS.simulation.manage) @Post(":id/step") step(@Param("id") id: string) { return this.service.step(id); }
  @Permissions(PERMISSIONS.simulation.manage) @Post(":id/cancel") @HttpCode(200) cancel(@Param("id") id: string, @Req() request: AuthenticatedRequest) { return this.service.cancel(id, request.user.id); }
  @Permissions(PERMISSIONS.simulation.manage) @Post(":id/fail") @HttpCode(200) fail(@Param("id") id: string, @Body() dto: FailSimulationDto, @Req() request: AuthenticatedRequest) { return this.service.fail(id, dto, request.user.id); }
  @Permissions(PERMISSIONS.simulation.manage) @Post(":id/decisions") @HttpCode(201) recordDecision(@Param("id") id: string, @Body() dto: RecordDecisionDto, @Req() request: AuthenticatedRequest) { return this.service.recordDecision(id, dto, request.user.id); }
  @Permissions(PERMISSIONS.simulation.manage) @Post(":id/finish") @HttpCode(200) finish(@Param("id") id: string, @Req() request: AuthenticatedRequest) { return this.service.finish(id, request.user.id); }
}
