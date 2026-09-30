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
  CreatePollingSectionDto,
  UpdatePollingSectionDto,
} from "./dto/polling-section.dto";
import { PollingSectionsService } from "./polling-sections.service";

@Controller("polling-sections")
export class PollingSectionsController {
  constructor(private readonly service: PollingSectionsService) {}
  @Get() findAll(@Query("pollingPlaceId") pollingPlaceId?: string) {
    return this.service.findAll(pollingPlaceId);
  }
  @Get(":id") findOne(@Param("id") id: string) {
    return this.service.findOne(id);
  }
  @Post() create(@Body() dto: CreatePollingSectionDto) {
    return this.service.create(dto);
  }
  @Patch(":id") update(
    @Param("id") id: string,
    @Body() dto: UpdatePollingSectionDto,
  ) {
    return this.service.update(id, dto);
  }
  @Delete(":id") @HttpCode(204) remove(@Param("id") id: string) {
    return this.service.remove(id);
  }
}
