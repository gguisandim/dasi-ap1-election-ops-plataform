import { Body, Controller, Get, HttpCode, Param, Post } from "@nestjs/common";
import { Permissions } from "../../../../system/access-control/src/server/auth.decorators";
import { CreateSimulationDto } from "./dto/simulation.dto";
import { SimulatorService } from "./simulator.service";
@Permissions("simulation.read") @Controller("simulations")
export class SimulatorController {
  constructor(private readonly service: SimulatorService) {}
  @Get() list() { return this.service.list(); } @Get("scenarios") scenarios() { return this.service.scenarios(); } @Get(":id") get(@Param("id") id: string) { return this.service.get(id); }
  @Permissions("simulation.manage") @Post() create(@Body() dto: CreateSimulationDto) { return this.service.create(dto); }
  @Permissions("simulation.manage") @Post(":id/start") start(@Param("id") id: string) { return this.service.start(id); }
  @Permissions("simulation.manage") @Post(":id/pause") pause(@Param("id") id: string) { return this.service.pause(id); }
  @Permissions("simulation.manage") @Post(":id/tick") tick(@Param("id") id: string) { return this.service.tick(id); }
  @Permissions("simulation.manage") @Post(":id/finish") @HttpCode(200) finish(@Param("id") id: string) { return this.service.finish(id); }
}
