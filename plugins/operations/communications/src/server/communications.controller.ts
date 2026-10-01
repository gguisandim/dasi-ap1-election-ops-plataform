import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
} from "@nestjs/common";
import type { AuthenticatedRequest } from "@eops/security";
import { PERMISSIONS, Permissions } from "@eops/security";
import {
  CancelCommunicationDto,
  CommunicationQueryDto,
  CommunicationRecipientQueryDto,
  ConfirmRecipientDto,
  CreateCommunicationDto,
  PublishCommunicationDto,
  ScheduleCommunicationDto,
  UpdateCommunicationDto,
} from "./dto/communication.dto";
import { ReplaceAudiencesDto } from "./dto/communication-audience.dto";
import {
  CreateCommunicationCategoryDto,
  CreateCommunicationTagDto,
  CreateCommunicationTemplateDto,
  UpdateCommunicationCategoryDto,
  UpdateCommunicationTemplateDto,
} from "./dto/communication-template.dto";
import { CommunicationsService } from "./communications.service";
import { CommunicationRecipientsService } from "./communication-recipients.service";
import { CommunicationTemplatesService } from "./communication-templates.service";

@Permissions(PERMISSIONS.communications.read)
@Controller("communications")
export class CommunicationsController {
  constructor(
    private readonly service: CommunicationsService,
    private readonly recipients: CommunicationRecipientsService,
    private readonly templates: CommunicationTemplatesService,
  ) {}

  // ------------------------------------------------------------------ painel

  @Get()
  findAll(@Query() query: CommunicationQueryDto) {
    return this.service.findAll(query);
  }

  @Get("dashboard")
  dashboard(@Query("electionId") electionId?: string) {
    return this.service.dashboard(electionId);
  }

  /** Comunicados publicados dirigidos ao usuário autenticado, ainda pendentes. */
  @Get("pending")
  pending(@Req() request: AuthenticatedRequest) {
    return this.recipients.pendingForUser(request.user.id);
  }

  /** Histórico completo da caixa do usuário autenticado. */
  @Get("inbox")
  inbox(@Req() request: AuthenticatedRequest) {
    return this.recipients.inboxForUser(request.user.id);
  }

  @Get("reference-data")
  referenceData(@Query("electionId") electionId?: string) {
    return this.service.referenceData(electionId);
  }

  // ------------------------------------------------- categorias e etiquetas

  @Get("categories")
  categories(@Query("includeInactive") includeInactive?: string) {
    return this.templates.listCategories(includeInactive === "true");
  }

  @Permissions(PERMISSIONS.communications.manage)
  @Post("categories")
  createCategory(@Body() dto: CreateCommunicationCategoryDto) {
    return this.templates.createCategory(dto);
  }

  @Permissions(PERMISSIONS.communications.manage)
  @Patch("categories/:id")
  updateCategory(@Param("id") id: string, @Body() dto: UpdateCommunicationCategoryDto) {
    return this.templates.updateCategory(id, dto);
  }

  @Get("tags")
  tags() {
    return this.templates.listTags();
  }

  @Permissions(PERMISSIONS.communications.manage)
  @Post("tags")
  createTag(@Body() dto: CreateCommunicationTagDto) {
    return this.templates.createTag(dto);
  }

  // -------------------------------------------------------------- templates

  @Get("templates")
  listTemplates(@Query("includeInactive") includeInactive?: string) {
    return this.templates.listTemplates(includeInactive === "true");
  }

  @Get("templates/:id")
  findTemplate(@Param("id") id: string) {
    return this.templates.findTemplate(id);
  }

  @Permissions(PERMISSIONS.communications.manage)
  @Post("templates")
  createTemplate(
    @Body() dto: CreateCommunicationTemplateDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.templates.createTemplate(dto, {
      id: request.user.id,
      name: request.user.email,
    });
  }

  @Permissions(PERMISSIONS.communications.manage)
  @Patch("templates/:id")
  updateTemplate(@Param("id") id: string, @Body() dto: UpdateCommunicationTemplateDto) {
    return this.templates.updateTemplate(id, dto);
  }

  @Permissions(PERMISSIONS.communications.manage)
  @Delete("templates/:id")
  @HttpCode(204)
  removeTemplate(@Param("id") id: string) {
    return this.templates.removeTemplate(id);
  }

  // --------------------------------------------------- acompanhamento de leitura

  @Get(":id/metrics")
  metrics(@Param("id") id: string) {
    return this.service.metricsFor(id);
  }

  @Get(":id/timeline")
  timeline(@Param("id") id: string) {
    return this.service.timelineFor(id);
  }

  @Get(":id/recipients")
  listRecipients(@Param("id") id: string, @Query() query: CommunicationRecipientQueryDto) {
    return this.recipients.list(id, query);
  }

  @Permissions(PERMISSIONS.communications.publish)
  @Post(":id/recipients/sync")
  syncRecipients(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.service.syncRecipients(id, {
      id: request.user.id,
      email: request.user.email,
    });
  }

  /**
   * Marca a leitura de um destinatário. O próprio destinatário pode registrar a
   * sua; a permissão `publish` permite registrar em nome de outro (registro
   * manual feito pela coordenação).
   */
  @Post(":id/recipients/:recipientId/read")
  markRead(
    @Param("id") id: string,
    @Param("recipientId") recipientId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.recipients.markRead(id, recipientId, {
      id: request.user.id,
      name: request.user.email,
    });
  }

  @Post(":id/recipients/:recipientId/confirm")
  confirm(
    @Param("id") id: string,
    @Param("recipientId") recipientId: string,
    @Body() dto: ConfirmRecipientDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.recipients.confirm(id, recipientId, dto.note, {
      id: request.user.id,
      name: request.user.email,
    });
  }

  // ------------------------------------------------------------- comunicados

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.service.findOne(id);
  }

  @Permissions(PERMISSIONS.communications.manage)
  @Post()
  create(@Body() dto: CreateCommunicationDto, @Req() request: AuthenticatedRequest) {
    return this.service.create(dto, { id: request.user.id, email: request.user.email });
  }

  @Permissions(PERMISSIONS.communications.manage)
  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() dto: UpdateCommunicationDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.update(id, dto, { id: request.user.id, email: request.user.email });
  }

  @Permissions(PERMISSIONS.communications.manage)
  @Put(":id/audiences")
  replaceAudiences(
    @Param("id") id: string,
    @Body() dto: ReplaceAudiencesDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.replaceAudiences(id, dto, {
      id: request.user.id,
      email: request.user.email,
    });
  }

  @Permissions(PERMISSIONS.communications.publish)
  @Post(":id/publish")
  publish(
    @Param("id") id: string,
    @Body() dto: PublishCommunicationDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.publish(id, dto, { id: request.user.id, email: request.user.email });
  }

  @Permissions(PERMISSIONS.communications.publish)
  @Post(":id/schedule")
  schedule(
    @Param("id") id: string,
    @Body() dto: ScheduleCommunicationDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.schedule(id, dto, { id: request.user.id, email: request.user.email });
  }

  @Permissions(PERMISSIONS.communications.publish)
  @Post(":id/cancel")
  cancel(
    @Param("id") id: string,
    @Body() dto: CancelCommunicationDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.cancel(id, dto, { id: request.user.id, email: request.user.email });
  }

  @Permissions(PERMISSIONS.communications.publish)
  @Post(":id/archive")
  archive(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.service.archive(id, { id: request.user.id, email: request.user.email });
  }

  @Permissions(PERMISSIONS.communications.manage)
  @Delete(":id")
  @HttpCode(204)
  remove(@Param("id") id: string) {
    return this.service.remove(id);
  }
}
