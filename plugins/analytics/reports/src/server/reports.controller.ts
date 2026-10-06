import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, Res } from "@nestjs/common";
import type { Response } from "express";
import { PERMISSIONS, Permissions, type AuthenticatedRequest } from "@eops/security";
import { ReportQueryDto } from "./dto/report-query.dto";
import { IncidentsReportQueryDto } from "./dto/incidents-report-query.dto";
import {
  CreateReportViewDto,
  DrilldownQueryDto,
  ExportJsonQueryDto,
  SlaQueryDto,
  TimeseriesQueryDto,
  UpdateReportViewDto,
  ZonesQueryDto,
} from "./dto/analytics.dto";
import { ReportsService } from "./reports.service";
import { ReportsViewsService } from "./reports-views.service";

@Permissions(PERMISSIONS.reports.read)
@Controller("reports")
export class ReportsController {
  constructor(
    private readonly service: ReportsService,
    private readonly views: ReportsViewsService,
  ) {}

  @Get("executive") executive(@Query() query: ReportQueryDto) { return this.service.executive(query); }
  @Get("operations") operations(@Query() query: ReportQueryDto) { return this.service.operations(query); }
  @Get("incidents") incidents(@Query() query: IncidentsReportQueryDto) { return this.service.incidents(query); }
  @Get("transmission") transmission(@Query() query: ReportQueryDto) { return this.service.transmission(query); }
  @Get("workforce") workforce(@Query() query: ReportQueryDto) { return this.service.workforce(query); }
  @Get("logistics") logistics(@Query() query: ReportQueryDto) { return this.service.logistics(query); }
  @Get("assets") assets(@Query() query: ReportQueryDto) { return this.service.assets(query); }
  @Get("timeseries") timeseries(@Query() query: TimeseriesQueryDto) { return this.service.timeseries(query); }
  @Get("sla") sla(@Query() query: SlaQueryDto) { return this.service.sla(query); }
  @Get("zones") zones(@Query() query: ZonesQueryDto) { return this.service.zoneComparison(query); }
  @Get("drilldown") drilldown(@Query() query: DrilldownQueryDto) { return this.service.drilldown(query); }

  @Get("views") listViews(@Req() request: AuthenticatedRequest) { return this.views.list(request.user.id, request.user.permissions); }
  @Post("views") createView(@Body() dto: CreateReportViewDto, @Req() request: AuthenticatedRequest) { return this.views.create(dto, request.user.id, request.user.permissions); }
  @Patch("views/:id") updateView(@Param("id") id: string, @Body() dto: UpdateReportViewDto, @Req() request: AuthenticatedRequest) { return this.views.update(id, dto, request.user.id, request.user.permissions); }
  @Delete("views/:id") removeView(@Param("id") id: string, @Req() request: AuthenticatedRequest) { return this.views.remove(id, request.user.id, request.user.permissions); }

  @Permissions(PERMISSIONS.reports.export) @Get("export.csv") async csv(@Query() query: ReportQueryDto, @Res() response: Response) { const content = await this.service.csv(query); response.setHeader("Content-Type", "text/csv; charset=utf-8"); response.setHeader("Content-Disposition", "attachment; filename=relatorio-election-ops.csv"); response.send(`${content}`); }
  @Permissions(PERMISSIONS.reports.export) @Get("export.pdf") async pdf(@Query() query: ReportQueryDto, @Res() response: Response) { const content = await this.service.pdf(query); response.setHeader("Content-Type", "application/pdf"); response.setHeader("Content-Disposition", "attachment; filename=relatorio-election-ops.pdf"); response.send(content); }
  @Permissions(PERMISSIONS.reports.export) @Get("export.json") exportJson(@Query() query: ExportJsonQueryDto) { return this.service.exportJson(query); }
}
