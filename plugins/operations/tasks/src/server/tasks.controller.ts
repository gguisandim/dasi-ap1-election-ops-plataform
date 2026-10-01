import { Body, Controller, Delete, Get, Param, Post, Query, Req, Patch } from "@nestjs/common";
import type { AuthenticatedRequest } from "@eops/security";
import { PERMISSIONS, Permissions } from "@eops/security";
import { CreateTaskCommentDto, CreateTaskDependencyDto, CreateTaskDto, TasksQueryDto, UpdateTaskDto } from "./dto/tasks.dto";
import { TasksService } from "./tasks.service";

@Permissions(PERMISSIONS.tasks.read)
@Controller("tasks")
export class TasksController {
  constructor(private readonly service: TasksService) {}

  @Get("dashboard") dashboard(@Query() query: TasksQueryDto) { return this.service.dashboard(query); }
  @Get("references") references() { return this.service.references(); }
  @Get() tasks(@Query() query: TasksQueryDto) { return this.service.tasks(query); }
  @Get(":id") task(@Param("id") id: string) { return this.service.findTask(id); }

  @Permissions(PERMISSIONS.tasks.manage)
  @Post() createTask(@Body() dto: CreateTaskDto, @Req() request: AuthenticatedRequest) { return this.service.createTask(dto, request.user.id); }

  @Permissions(PERMISSIONS.tasks.manage)
  @Patch(":id") updateTask(@Param("id") id: string, @Body() dto: UpdateTaskDto, @Req() request: AuthenticatedRequest) { return this.service.updateTask(id, dto, request.user.id); }

  @Permissions(PERMISSIONS.tasks.manage)
  @Post(":id/comments") addComment(@Param("id") id: string, @Body() dto: CreateTaskCommentDto, @Req() request: AuthenticatedRequest) { return this.service.addComment(id, dto, request.user.id); }

  @Permissions(PERMISSIONS.tasks.manage)
  @Post(":id/dependencies") addDependency(@Param("id") id: string, @Body() dto: CreateTaskDependencyDto, @Req() request: AuthenticatedRequest) { return this.service.addDependency(id, dto, request.user.id); }

  @Permissions(PERMISSIONS.tasks.manage)
  @Delete(":id/dependencies/:dependsOnId") removeDependency(@Param("id") id: string, @Param("dependsOnId") dependsOnId: string, @Req() request: AuthenticatedRequest) { return this.service.removeDependency(id, dependsOnId, request.user.id); }
}