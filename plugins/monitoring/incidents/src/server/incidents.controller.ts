import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, Req } from "@nestjs/common";
import type { AuthenticatedRequest } from "@eops/security";
import { PERMISSIONS, Permissions } from "@eops/security";
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

@Permissions(PERMISSIONS.incidents.read)
@Controller("incidents")
export class IncidentsController {
  constructor(private readonly service: IncidentsService) {}

  @Get()
  findAll(@Query() query: IncidentQueryDto) { return this.service.findAll(query); }

  @Get("dashboard")
  dashboard() { return this.service.dashboard(); }

  @Get("categories")
  categories() { return this.service.listCategories(); }

  @Permissions(PERMISSIONS.incidents.update)
  @Post("categories")
  createCategory(@Body() dto: CreateIncidentCategoryDto) { return this.service.createCategory(dto); }

  @Permissions(PERMISSIONS.incidents.update)
  @Patch("categories/:id")
  updateCategory(@Param("id") id: string, @Body() dto: UpdateIncidentCategoryDto) { return this.service.updateCategory(id, dto); }

  @Get(":id")
  findOne(@Param("id") id: string) { return this.service.findOne(id); }

  @Permissions(PERMISSIONS.incidents.create)
  @Post()
  create(@Body() dto: CreateIncidentDto, @Req() request: AuthenticatedRequest) {
    return this.service.create(dto, request.user.id);
  }

  @Permissions(PERMISSIONS.incidents.update)
  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateIncidentDto) { return this.service.update(id, dto); }

  @Permissions(PERMISSIONS.incidents.update)
  @Patch(":id/status")
  changeStatus(@Param("id") id: string, @Body() dto: ChangeIncidentStatusDto, @Req() request: AuthenticatedRequest) {
    return this.service.changeStatus(id, dto, request.user.id);
  }

  @Permissions(PERMISSIONS.incidents.assign)
  @Post(":id/assignments")
  assign(@Param("id") id: string, @Body() dto: AssignIncidentDto, @Req() request: AuthenticatedRequest) {
    return this.service.assign(id, dto, request.user.id);
  }

  @Permissions(PERMISSIONS.incidents.update)
  @Post(":id/comments")
  comment(@Param("id") id: string, @Body() dto: AddIncidentCommentDto, @Req() request: AuthenticatedRequest) {
    return this.service.addComment(id, dto, request.user.id);
  }

  @Permissions(PERMISSIONS.incidents.update)
  @Delete(":id")
  @HttpCode(204)
  remove(@Param("id") id: string) { return this.service.remove(id); }
}
