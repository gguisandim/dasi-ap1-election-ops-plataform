import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import {
  CreateElectionDto,
  CreateRoundDto,
  UpdateElectionDto,
  UpdateRoundDto,
} from "./dto/election.dto";
import { ElectionsService } from "./elections.service";

@Controller("elections")
export class ElectionsController {
  constructor(private readonly service: ElectionsService) {}
  @Get() findAll() {
    return this.service.findAll();
  }
  @Get(":id") findOne(@Param("id") id: string) {
    return this.service.findOne(id);
  }
  @Post() create(@Body() dto: CreateElectionDto) {
    return this.service.create(dto);
  }
  @Patch(":id") update(
    @Param("id") id: string,
    @Body() dto: UpdateElectionDto,
  ) {
    return this.service.update(id, dto);
  }
  @Delete(":id") @HttpCode(204) remove(@Param("id") id: string) {
    return this.service.remove(id);
  }
  @Post(":id/rounds") createRound(
    @Param("id") id: string,
    @Body() dto: CreateRoundDto,
  ) {
    return this.service.createRound(id, dto);
  }
  @Patch("rounds/:roundId") updateRound(
    @Param("roundId") id: string,
    @Body() dto: UpdateRoundDto,
  ) {
    return this.service.updateRound(id, dto);
  }
  @Delete("rounds/:roundId") @HttpCode(204) removeRound(
    @Param("roundId") id: string,
  ) {
    return this.service.removeRound(id);
  }
}
