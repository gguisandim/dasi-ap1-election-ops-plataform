import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from "@nestjs/common";
import {
  AddIncidentCommentDto,
  AssignIncidentDto,
  ChangeIncidentStatusDto,
  CreateIncidentCategoryDto,
  CreateIncidentDto,
  IncidentQueryDto,
  UpdateIncidentCategoryDto,
  UpdateIncidentDto,
} from "./dto/incident.dto";
import { IncidentsService } from "./incidents.service";
import { Permissions } from "../../../../system/access-control/src/server/auth.decorators";

@Permissions("incidents.read")
@Controller("incidents")
export class IncidentsController {
  constructor(private readonly service: IncidentsService) {}
  @Get() findAll(@Query() query: IncidentQueryDto) { return this.service.findAll(query); }
  @Get("dashboard") dashboard() { return this.service.dashboard(); }
  @Get("categories") categories() { return this.service.listCategories(); }
  @Permissions("incidents.update") @Post("categories") createCategory(@Body() dto: CreateIncidentCategoryDto) { return this.service.createCategory(dto); }
  @Permissions("incidents.update") @Patch("categories/:id") updateCategory(@Param("id") id: string, @Body() dto: UpdateIncidentCategoryDto) { return this.service.updateCategory(id, dto); }
  @Get(":id") findOne(@Param("id") id: string) { return this.service.findOne(id); }
  @Permissions("incidents.create") @Post() create(@Body() dto: CreateIncidentDto) { return this.service.create(dto); }
  @Permissions("incidents.update") @Patch(":id") update(@Param("id") id: string, @Body() dto: UpdateIncidentDto) { return this.service.update(id, dto); }
  @Permissions("incidents.update") @Patch(":id/status") changeStatus(@Param("id") id: string, @Body() dto: ChangeIncidentStatusDto) { return this.service.changeStatus(id, dto); }
  @Permissions("incidents.assign") @Post(":id/assignments") assign(@Param("id") id: string, @Body() dto: AssignIncidentDto) { return this.service.assign(id, dto); }
  @Permissions("incidents.update") @Post(":id/comments") comment(@Param("id") id: string, @Body() dto: AddIncidentCommentDto) { return this.service.addComment(id, dto); }
  @Permissions("incidents.update") @Delete(":id") @HttpCode(204) remove(@Param("id") id: string) { return this.service.remove(id); }
}
