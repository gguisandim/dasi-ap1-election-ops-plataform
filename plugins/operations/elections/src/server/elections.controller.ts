import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
} from "@nestjs/common";
import type { AuthenticatedRequest } from "../../../../system/access-control/src/server/auth.types";
import { Permissions } from "../../../../system/access-control/src/server/auth.decorators";
import {
  CreateElectionDto,
  CreateRoundDto,
  UpdateElectionDto,
  UpdateRoundDto,
} from "./dto/election.dto";
import { ElectionsService } from "./elections.service";

@Permissions("elections.read")
@Controller("elections")
export class ElectionsController {
  constructor(private readonly service: ElectionsService) {}

  @Get()
  findAll() { return this.service.findAll(); }

  @Get(":id")
  findOne(@Param("id") id: string) { return this.service.findOne(id); }

  @Permissions("elections.manage")
  @Post()
  create(@Body() dto: CreateElectionDto, @Req() request: AuthenticatedRequest) {
    return this.service.create(dto, request.user.id);
  }

  @Permissions("elections.manage")
  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateElectionDto) { return this.service.update(id, dto); }

  @Permissions("elections.manage")
  @Delete(":id")
  @HttpCode(204)
  remove(@Param("id") id: string) { return this.service.remove(id); }

  @Permissions("elections.manage")
  @Post(":id/rounds")
  createRound(@Param("id") id: string, @Body() dto: CreateRoundDto) { return this.service.createRound(id, dto); }

  @Permissions("elections.manage")
  @Patch("rounds/:roundId")
  updateRound(@Param("roundId") id: string, @Body() dto: UpdateRoundDto) { return this.service.updateRound(id, dto); }

  @Permissions("elections.manage")
  @Delete("rounds/:roundId")
  @HttpCode(204)
  removeRound(@Param("roundId") id: string) { return this.service.removeRound(id); }
}
