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
  CreateRiskCategoryDto,
  CreateRiskDto,
  MaterializeRiskDto,
  ReplaceRiskMitigationsDto,
  RiskQueryDto,
  UpdateRiskCategoryDto,
  UpdateRiskDto,
} from "./dto/risk.dto";
import { RiskCatalogService } from "./risk-catalog.service";
import { RiskService } from "./risk.service";

/** Ator derivado do usuário autenticado; o serviço resolve o nome de exibição. */
const actorOf = (request: AuthenticatedRequest) => ({
  id: request.user.id,
  email: request.user.email,
});

@Permissions(PERMISSIONS.risks.read)
@Controller("risks")
export class RiskController {
  constructor(
    private readonly service: RiskService,
    private readonly catalog: RiskCatalogService,
  ) {}

  // ------------------------------------------------------------------ leitura

  @Get()
  findAll(@Query() query: RiskQueryDto) {
    return this.service.findAll(query);
  }

  @Get("dashboard")
  dashboard(@Query("electionId") electionId?: string) {
    return this.service.dashboard(electionId);
  }

  /** Matriz 5×5 com a contagem de riscos por combinação de probabilidade e impacto. */
  @Get("matrix")
  matrix(@Query() query: RiskQueryDto) {
    return this.service.matrix(query);
  }

  @Get("reference-data")
  referenceData() {
    return this.service.referenceData();
  }

  @Get("categories")
  categories(@Query("includeInactive") includeInactive?: string) {
    return this.catalog.list(includeInactive === "true");
  }

  @Permissions(PERMISSIONS.risks.manage)
  @Post("categories")
  createCategory(@Body() dto: CreateRiskCategoryDto) {
    return this.catalog.create(dto);
  }

  @Permissions(PERMISSIONS.risks.manage)
  @Patch("categories/:id")
  updateCategory(@Param("id") id: string, @Body() dto: UpdateRiskCategoryDto) {
    return this.catalog.update(id, dto);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.service.findOne(id);
  }

  @Get(":id/timeline")
  timeline(@Param("id") id: string) {
    return this.service.timelineFor(id);
  }

  // ------------------------------------------------------------------ escrita

  @Permissions(PERMISSIONS.risks.manage)
  @Post()
  create(@Body() dto: CreateRiskDto, @Req() request: AuthenticatedRequest) {
    return this.service.create(dto, actorOf(request));
  }

  @Permissions(PERMISSIONS.risks.assess)
  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() dto: UpdateRiskDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.update(id, dto, actorOf(request));
  }

  @Permissions(PERMISSIONS.risks.manage)
  @Put(":id/mitigations")
  replaceMitigations(
    @Param("id") id: string,
    @Body() dto: ReplaceRiskMitigationsDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.replaceMitigations(id, dto, actorOf(request));
  }

  @Permissions(PERMISSIONS.risks.assess)
  @Post(":id/materialize")
  materialize(
    @Param("id") id: string,
    @Body() dto: MaterializeRiskDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.materialize(id, dto, actorOf(request));
  }

  @Permissions(PERMISSIONS.risks.assess)
  @Post(":id/close")
  close(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.service.close(id, actorOf(request));
  }

  @Permissions(PERMISSIONS.risks.manage)
  @Delete(":id")
  @HttpCode(204)
  remove(@Param("id") id: string) {
    return this.service.remove(id);
  }
}
