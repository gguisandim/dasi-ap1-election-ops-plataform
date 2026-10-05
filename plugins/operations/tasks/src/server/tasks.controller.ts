import { Body, Controller, Delete, Get, Param, Post, Query, Req, Patch } from "@nestjs/common";
import type { AuthenticatedRequest } from "@eops/security";
import { PERMISSIONS, Permissions } from "@eops/security";
import {
  BulkUpdateTasksDto,
  CreateChecklistItemDto,
  CreateMilestoneDto,
  CreateSavedFilterDto,
  CreateSubtaskDto,
  CreateTaskCommentDto,
  CreateTaskDependencyDto,
  CreateTaskDto,
  CreateTaskLabelDto,
  TasksQueryDto,
  UpdateChecklistItemDto,
  UpdateMilestoneDto,
  UpdateTaskDto,
} from "./dto/tasks.dto";
import { TasksService } from "./tasks.service";

@Permissions(PERMISSIONS.tasks.read)
@Controller("tasks")
export class TasksController {
  constructor(private readonly service: TasksService) {}

  // Rotas estáticas de um segmento precisam ser declaradas antes de `:id`.
  @Get("dashboard") dashboard(@Query() query: TasksQueryDto) { return this.service.dashboard(query); }
  @Get("references") references() { return this.service.references(); }
  @Get("workload") workload(@Query() query: TasksQueryDto) { return this.service.workload(query); }
  @Get("labels") labels() { return this.service.labels(); }
  @Get("milestones") milestones(@Query("electionId") electionId?: string) { return this.service.milestones(electionId); }
  @Get("saved-filters") savedFilters(@Req() request: AuthenticatedRequest) { return this.service.savedFilters(request.user.id); }
  @Get() tasks(@Query() query: TasksQueryDto) { return this.service.tasks(query); }
  @Get(":id") task(@Param("id") id: string) { return this.service.findTask(id); }
  @Get(":id/dependencies") dependencies(@Param("id") id: string) { return this.service.dependencies(id); }
  @Get(":id/subtasks") subtasks(@Param("id") id: string) { return this.service.subtasks(id); }

  @Permissions(PERMISSIONS.tasks.manage)
  @Post() createTask(@Body() dto: CreateTaskDto, @Req() request: AuthenticatedRequest) { return this.service.createTask(dto, request.user.id); }

  @Permissions(PERMISSIONS.tasks.manage)
  @Post("labels") createLabel(@Body() dto: CreateTaskLabelDto) { return this.service.createLabel(dto); }

  @Permissions(PERMISSIONS.tasks.manage)
  @Post("milestones") createMilestone(@Body() dto: CreateMilestoneDto) { return this.service.createMilestone(dto); }

  @Post("saved-filters") createSavedFilter(@Body() dto: CreateSavedFilterDto, @Req() request: AuthenticatedRequest) { return this.service.createSavedFilter(dto, request.user.id); }

  @Permissions(PERMISSIONS.tasks.manage)
  @Post(":id/subtasks") createSubtask(@Param("id") id: string, @Body() dto: CreateSubtaskDto, @Req() request: AuthenticatedRequest) { return this.service.createSubtask(id, dto, request.user.id); }

  @Permissions(PERMISSIONS.tasks.manage)
  @Post(":id/checklist-items") addChecklistItem(@Param("id") id: string, @Body() dto: CreateChecklistItemDto, @Req() request: AuthenticatedRequest) { return this.service.addChecklistItem(id, dto, request.user.id); }

  @Permissions(PERMISSIONS.tasks.manage)
  @Post(":id/comments") addComment(@Param("id") id: string, @Body() dto: CreateTaskCommentDto, @Req() request: AuthenticatedRequest) { return this.service.addComment(id, dto, request.user.id); }

  @Permissions(PERMISSIONS.tasks.manage)
  @Post(":id/dependencies") addDependency(@Param("id") id: string, @Body() dto: CreateTaskDependencyDto, @Req() request: AuthenticatedRequest) { return this.service.addDependency(id, dto, request.user.id); }

  // `bulk` precisa vir antes de `:id` para não ser capturado como identificador.
  @Permissions(PERMISSIONS.tasks.manage)
  @Patch("bulk") bulkUpdate(@Body() dto: BulkUpdateTasksDto, @Req() request: AuthenticatedRequest) { return this.service.bulkUpdate(dto, request.user.id); }

  @Permissions(PERMISSIONS.tasks.manage)
  @Patch(":id") updateTask(@Param("id") id: string, @Body() dto: UpdateTaskDto, @Req() request: AuthenticatedRequest) { return this.service.updateTask(id, dto, request.user.id); }

  @Permissions(PERMISSIONS.tasks.manage)
  @Patch("milestones/:id") updateMilestone(@Param("id") id: string, @Body() dto: UpdateMilestoneDto) { return this.service.updateMilestone(id, dto); }

  @Permissions(PERMISSIONS.tasks.manage)
  @Patch("checklist-items/:itemId") updateChecklistItem(@Param("itemId") itemId: string, @Body() dto: UpdateChecklistItemDto, @Req() request: AuthenticatedRequest) { return this.service.updateChecklistItem(itemId, dto, request.user.id); }

  @Permissions(PERMISSIONS.tasks.manage)
  @Delete("labels/:id") deleteLabel(@Param("id") id: string) { return this.service.deleteLabel(id); }

  @Delete("saved-filters/:id") deleteSavedFilter(@Param("id") id: string, @Req() request: AuthenticatedRequest) { return this.service.deleteSavedFilter(id, request.user.id); }

  @Permissions(PERMISSIONS.tasks.manage)
  @Delete("checklist-items/:itemId") deleteChecklistItem(@Param("itemId") itemId: string, @Req() request: AuthenticatedRequest) { return this.service.deleteChecklistItem(itemId, request.user.id); }

  @Permissions(PERMISSIONS.tasks.manage)
  @Delete(":id/dependencies/:dependsOnId") removeDependency(@Param("id") id: string, @Param("dependsOnId") dependsOnId: string, @Req() request: AuthenticatedRequest) { return this.service.removeDependency(id, dependsOnId, request.user.id); }
}
