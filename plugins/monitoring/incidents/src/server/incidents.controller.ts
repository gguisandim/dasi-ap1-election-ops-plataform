import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, Req } from "@nestjs/common";
import type { AuthenticatedRequest } from "@eops/security";
import { PERMISSIONS, Permissions } from "@eops/security";
import { getAllowedIncidentTransitions, type IncidentAvailableAction } from "@eops/shared/incidents";
import {
  AddIncidentCommentDto,
  AssignIncidentDto,
  ChangeIncidentStatusDto,
  CreateIncidentCategoryDto,
  CreateIncidentDto,
  IncidentQueryDto,
  IncidentActionDto,
  EscalateIncidentDto,
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

  @Get("queue")
  queue(@Query() query: IncidentQueryDto) { return this.service.queue(query); }

  @Get("categories")
  categories() { return this.service.listCategories(); }

  @Permissions(PERMISSIONS.incidents.update)
  @Post("categories")
  createCategory(@Body() dto: CreateIncidentCategoryDto, @Req() request: AuthenticatedRequest) { return this.service.createCategory(dto, request.user.id); }

  @Permissions(PERMISSIONS.incidents.update)
  @Patch("categories/:id")
  updateCategory(@Param("id") id: string, @Body() dto: UpdateIncidentCategoryDto, @Req() request: AuthenticatedRequest) { return this.service.updateCategory(id, dto, request.user.id); }

  @Get(":id")
  async findOne(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    const incident = await this.service.findOne(id);
    const permissions = new Set(request.user.permissions);
    const transitions = getAllowedIncidentTransitions(incident.status);
    const active = !["CLOSED", "CANCELLED"].includes(incident.status);
    const operational = !["RESOLVED", "CLOSED", "CANCELLED"].includes(incident.status);
    const availableActions: IncidentAvailableAction[] = [];
    if (permissions.has(PERMISSIONS.incidents.update) && active) {
      availableActions.push("EDIT", "COMMENT");
      if (operational && !incident.acknowledgedAt) availableActions.push("ACKNOWLEDGE");
      if (operational && incident.escalationLevel < 3) availableActions.push("ESCALATE");
      if (incident.status !== "RESOLVED" && transitions.some((status) => !["RESOLVED", "CLOSED", "CANCELLED"].includes(status))) availableActions.push("CHANGE_STATUS");
      if (transitions.includes("IN_PROGRESS") && incident.status === "RESOLVED") availableActions.push("REOPEN");
      if (transitions.includes("CANCELLED")) availableActions.push("CANCEL");
    }
    if (permissions.has(PERMISSIONS.incidents.assign) && operational) availableActions.push("ASSIGN");
    if (permissions.has(PERMISSIONS.incidents.resolve) && transitions.includes("RESOLVED")) availableActions.push("RESOLVE");
    if (permissions.has(PERMISSIONS.incidents.close) && transitions.includes("CLOSED")) availableActions.push("CLOSE");
    return { ...incident, availableActions };
  }

  @Permissions(PERMISSIONS.incidents.create)
  @Post()
  create(@Body() dto: CreateIncidentDto, @Req() request: AuthenticatedRequest) {
    return this.service.create(dto, request.user.id);
  }

  @Permissions(PERMISSIONS.incidents.update)
  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateIncidentDto, @Req() request: AuthenticatedRequest) { return this.service.update(id, dto, request.user.id); }

  @Permissions(PERMISSIONS.incidents.update)
  @Patch(":id/status")
  changeStatus(@Param("id") id: string, @Body() dto: ChangeIncidentStatusDto, @Req() request: AuthenticatedRequest) {
    return this.service.changeStatus(id, dto, request.user.id);
  }

  @Permissions(PERMISSIONS.incidents.update)
  @Post(":id/acknowledge")
  acknowledge(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.service.acknowledge(id, request.user.id);
  }

  @Permissions(PERMISSIONS.incidents.update)
  @Post(":id/escalate")
  escalate(@Param("id") id: string, @Body() dto: EscalateIncidentDto, @Req() request: AuthenticatedRequest) {
    return this.service.escalate(id, dto, request.user.id);
  }

  @Permissions(PERMISSIONS.incidents.resolve)
  @Post(":id/resolve")
  resolve(@Param("id") id: string, @Body() dto: IncidentActionDto, @Req() request: AuthenticatedRequest) {
    return this.service.resolve(id, dto.reason, request.user.id);
  }

  @Permissions(PERMISSIONS.incidents.update)
  @Post(":id/reopen")
  reopen(@Param("id") id: string, @Body() dto: IncidentActionDto, @Req() request: AuthenticatedRequest) {
    return this.service.reopen(id, dto.reason, request.user.id);
  }

  @Permissions(PERMISSIONS.incidents.close)
  @Post(":id/close")
  close(@Param("id") id: string, @Body() dto: IncidentActionDto, @Req() request: AuthenticatedRequest) {
    return this.service.close(id, dto.reason, request.user.id);
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
  remove(@Param("id") id: string, @Req() request: AuthenticatedRequest) { return this.service.remove(id, request.user.id); }
}
