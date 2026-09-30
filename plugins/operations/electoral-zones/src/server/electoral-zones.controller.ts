import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import {
  CreateElectoralZoneDto,
  UpdateElectoralZoneDto,
} from "./dto/electoral-zone.dto";
import { ElectoralZonesService } from "./electoral-zones.service";

@Controller("electoral-zones")
export class ElectoralZonesController {
  constructor(private readonly service: ElectoralZonesService) {}
  @Get() findAll(
    @Query("electionId") electionId?: string,
    @Query("search") search?: string,
  ) {
    return this.service.findAll(electionId, search);
  }
  @Get(":id") findOne(@Param("id") id: string) {
    return this.service.findOne(id);
  }
  @Post() create(@Body() dto: CreateElectoralZoneDto) {
    return this.service.create(dto);
  }
  @Patch(":id") update(
    @Param("id") id: string,
    @Body() dto: UpdateElectoralZoneDto,
  ) {
    return this.service.update(id, dto);
  }
  @Delete(":id") @HttpCode(204) remove(@Param("id") id: string) {
    return this.service.remove(id);
  }
}
