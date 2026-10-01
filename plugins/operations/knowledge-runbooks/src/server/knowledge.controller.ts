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
  CreateKnowledgeArticleDto,
  CreateKnowledgeCategoryDto,
  CreateKnowledgeTagDto,
  CreateRunbookUsageDto,
  KnowledgeQueryDto,
  KnowledgeUsageQueryDto,
  ReplaceRunbookStepsDto,
  RunbookRecommendationQueryDto,
  UpdateKnowledgeArticleDto,
  UpdateKnowledgeCategoryDto,
} from "./dto/knowledge.dto";
import { KnowledgeCatalogService } from "./knowledge-catalog.service";
import { KnowledgeService } from "./knowledge.service";
import { RunbookService } from "./runbook.service";

/** Ator derivado do usuário autenticado; o serviço resolve o nome de exibição. */
const actorOf = (request: AuthenticatedRequest) => ({
  id: request.user.id,
  email: request.user.email,
});

@Permissions(PERMISSIONS.knowledge.read)
@Controller("knowledge")
export class KnowledgeController {
  constructor(
    private readonly service: KnowledgeService,
    private readonly runbooks: RunbookService,
    private readonly catalog: KnowledgeCatalogService,
  ) {}

  // ------------------------------------------------------------------ leitura

  @Get()
  findAll(@Query() query: KnowledgeQueryDto) {
    return this.service.findAll(query);
  }

  @Get("dashboard")
  dashboard() {
    return this.service.dashboard();
  }

  @Get("reference-data")
  referenceData() {
    return this.service.referenceData();
  }

  @Get("metrics")
  metrics() {
    return this.runbooks.metrics();
  }

  /** Runbooks recomendados para um incidente ou para critérios avulsos. */
  @Get("recommendations")
  recommendations(
    @Query() query: RunbookRecommendationQueryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.runbooks.recommend(query, actorOf(request));
  }

  @Get("usages")
  usages(@Query() query: KnowledgeUsageQueryDto) {
    return this.runbooks.listUsages(query);
  }

  // ------------------------------------------------- categorias e etiquetas

  @Get("categories")
  categories(@Query("includeInactive") includeInactive?: string) {
    return this.catalog.listCategories(includeInactive === "true");
  }

  @Permissions(PERMISSIONS.knowledge.manage)
  @Post("categories")
  createCategory(@Body() dto: CreateKnowledgeCategoryDto) {
    return this.catalog.createCategory(dto);
  }

  @Permissions(PERMISSIONS.knowledge.manage)
  @Patch("categories/:id")
  updateCategory(@Param("id") id: string, @Body() dto: UpdateKnowledgeCategoryDto) {
    return this.catalog.updateCategory(id, dto);
  }

  @Get("tags")
  tags() {
    return this.catalog.listTags();
  }

  @Permissions(PERMISSIONS.knowledge.manage)
  @Post("tags")
  createTag(@Body() dto: CreateKnowledgeTagDto) {
    return this.catalog.createTag(dto.label);
  }

  // ---------------------------------------------------------- verbete e versões

  @Get(":id")
  async findOne(@Param("id") id: string) {
    const article = await this.service.findOne(id);
    await this.service.registerView(id);
    return article;
  }

  @Get(":id/versions")
  versions(@Param("id") id: string) {
    return this.service.listVersions(id);
  }

  @Get(":id/usages")
  articleUsages(@Param("id") id: string) {
    return this.runbooks.usagesForArticle(id);
  }

  @Permissions(PERMISSIONS.knowledge.manage)
  @Post()
  create(@Body() dto: CreateKnowledgeArticleDto, @Req() request: AuthenticatedRequest) {
    return this.service.create(dto, actorOf(request));
  }

  @Permissions(PERMISSIONS.knowledge.manage)
  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() dto: UpdateKnowledgeArticleDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.update(id, dto, actorOf(request));
  }

  @Permissions(PERMISSIONS.knowledge.manage)
  @Put(":id/steps")
  replaceSteps(
    @Param("id") id: string,
    @Body() dto: ReplaceRunbookStepsDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.replaceSteps(id, dto, actorOf(request));
  }

  @Permissions(PERMISSIONS.knowledge.publish)
  @Post(":id/publish")
  publish(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.service.publish(id, actorOf(request));
  }

  @Permissions(PERMISSIONS.knowledge.publish)
  @Post(":id/review")
  review(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.service.sendToReview(id, actorOf(request));
  }

  @Permissions(PERMISSIONS.knowledge.publish)
  @Post(":id/archive")
  archive(@Param("id") id: string) {
    return this.service.archive(id);
  }

  @Permissions(PERMISSIONS.knowledge.execute)
  @Post(":id/usages")
  registerUsage(
    @Param("id") id: string,
    @Body() dto: CreateRunbookUsageDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.runbooks.registerUsage(id, dto, actorOf(request));
  }

  @Permissions(PERMISSIONS.knowledge.manage)
  @Delete(":id")
  @HttpCode(204)
  remove(@Param("id") id: string) {
    return this.service.remove(id);
  }
}
