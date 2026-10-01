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
import { Permissions } from "../../../../system/access-control/src/server/auth.decorators";
import {
  CreateElectoralZoneDto,
  UpdateElectoralZoneDto,
} from "./dto/electoral-zone.dto";
import { ElectoralZonesService } from "./electoral-zones.service";

@Permissions("elections.read")
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
  @Permissions("elections.manage")
  @Post() create(@Body() dto: CreateElectoralZoneDto) {
    return this.service.create(dto);
  }
  @Permissions("elections.manage")
  @Patch(":id") update(
    @Param("id") id: string,
    @Body() dto: UpdateElectoralZoneDto,
  ) {
    return this.service.update(id, dto);
  }
  @Permissions("elections.manage")
  @Delete(":id") @HttpCode(204) remove(@Param("id") id: string) {
    return this.service.remove(id);
  }
}
