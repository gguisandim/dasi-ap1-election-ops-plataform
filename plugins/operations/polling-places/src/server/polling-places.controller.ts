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
import { PERMISSIONS, Permissions } from "@eops/security";
import {
  CreatePollingPlaceDto,
  PollingPlaceQueryDto,
  UpdatePollingPlaceDto,
} from "./dto/polling-place.dto";
import { PollingPlacesService } from "./polling-places.service";

@Permissions(PERMISSIONS.elections.read)
@Controller("polling-places")
export class PollingPlacesController {
  constructor(private readonly service: PollingPlacesService) {}
  @Get() findAll(@Query() query: PollingPlaceQueryDto) {
    return this.service.findAll(query);
  }
  @Get("map") findForMap(@Query() query: PollingPlaceQueryDto) {
    return this.service.findForMap(query);
  }
  @Get(":id") findOne(@Param("id") id: string) {
    return this.service.findOne(id);
  }
  @Permissions(PERMISSIONS.elections.manage)
  @Post() create(@Body() dto: CreatePollingPlaceDto) {
    return this.service.create(dto);
  }
  @Permissions(PERMISSIONS.elections.manage)
  @Patch(":id") update(
    @Param("id") id: string,
    @Body() dto: UpdatePollingPlaceDto,
  ) {
    return this.service.update(id, dto);
  }
  @Permissions(PERMISSIONS.elections.manage)
  @Delete(":id") @HttpCode(204) remove(@Param("id") id: string) {
    return this.service.remove(id);
  }
}
