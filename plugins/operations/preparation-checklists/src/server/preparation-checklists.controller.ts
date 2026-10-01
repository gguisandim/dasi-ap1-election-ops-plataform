import { Body, Controller, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import type { AuthenticatedRequest } from "@eops/security";
import { PERMISSIONS, Permissions } from "@eops/security";
import {
  AddTemplateItemDto,
  CreateChecklistDto,
  CreateChecklistEvidenceDto,
  CreateTemplateDto,
  PreparationChecklistsQueryDto,
  TemplatesQueryDto,
  UpdateChecklistItemDto,
  UpdateChecklistAssigneeDto,
  UpdateTemplateDto,
} from "./dto/preparation-checklists.dto";
import { PreparationChecklistsService } from "./preparation-checklists.service";

@Permissions(PERMISSIONS.preparationChecklists.read)
@Controller("preparation-checklists")
export class PreparationChecklistsController {
  constructor(private readonly service: PreparationChecklistsService) {}

  @Get("dashboard") dashboard(@Query() query: PreparationChecklistsQueryDto) { return this.service.dashboard(query); }
  @Get("references") references() { return this.service.references(); }
  @Get("templates") templates(@Query() query: TemplatesQueryDto) { return this.service.templates(query); }
  @Get("templates/:id") template(@Param("id") id: string) { return this.service.findTemplate(id); }
  @Permissions(PERMISSIONS.preparationChecklists.manage)
  @Post("templates") createTemplate(@Body() dto: CreateTemplateDto) { return this.service.createTemplate(dto); }
  @Permissions(PERMISSIONS.preparationChecklists.manage)
  @Patch("templates/:id") updateTemplate(@Param("id") id: string, @Body() dto: UpdateTemplateDto) { return this.service.updateTemplate(id, dto); }
  @Permissions(PERMISSIONS.preparationChecklists.manage)
  @Post("templates/:id/items") addTemplateItem(@Param("id") id: string, @Body() dto: AddTemplateItemDto) { return this.service.addTemplateItem(id, dto); }

  @Get() checklists(@Query() query: PreparationChecklistsQueryDto) { return this.service.checklists(query); }
  @Get(":id") checklist(@Param("id") id: string) { return this.service.findChecklist(id); }
  @Permissions(PERMISSIONS.preparationChecklists.manage)
  @Post() createChecklist(@Body() dto: CreateChecklistDto, @Req() request: AuthenticatedRequest) { return this.service.createChecklist(dto, request.user.id); }
  @Permissions(PERMISSIONS.preparationChecklists.manage)
  @Patch(":id/assignee") updateAssignee(@Param("id") id: string, @Body() dto: UpdateChecklistAssigneeDto, @Req() request: AuthenticatedRequest) { return this.service.updateAssignee(id, dto, request.user.id); }
  @Permissions(PERMISSIONS.preparationChecklists.manage)
  @Patch("items/:itemId") updateItem(@Param("itemId") itemId: string, @Body() dto: UpdateChecklistItemDto, @Req() request: AuthenticatedRequest) { return this.service.updateItem(itemId, dto, request.user.id); }
  @Permissions(PERMISSIONS.preparationChecklists.manage)
  @Post("items/:itemId/evidences") addEvidence(@Param("itemId") itemId: string, @Body() dto: CreateChecklistEvidenceDto, @Req() request: AuthenticatedRequest) { return this.service.addEvidence(itemId, dto, request.user.id); }
  @Permissions(PERMISSIONS.preparationChecklists.approve)
  @Post(":id/approve") approve(@Param("id") id: string, @Req() request: AuthenticatedRequest) { return this.service.approve(id, request.user.id); }
  @Permissions(PERMISSIONS.preparationChecklists.approve)
  @Post(":id/revoke-approval") revokeApproval(@Param("id") id: string, @Req() request: AuthenticatedRequest) { return this.service.revokeApproval(id, request.user.id); }
}