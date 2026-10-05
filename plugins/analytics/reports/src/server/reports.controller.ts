import { Controller, Get, Query, Res } from "@nestjs/common";
import type { Response } from "express";
import { PERMISSIONS, Permissions } from "@eops/security";
import { ReportQueryDto } from "./dto/report-query.dto";
import { IncidentsReportQueryDto } from "./dto/incidents-report-query.dto";
import { ReportsService } from "./reports.service";

@Permissions(PERMISSIONS.reports.read)
@Controller("reports")
export class ReportsController {
  constructor(private readonly service: ReportsService) {}
  @Get("executive") executive(@Query() query: ReportQueryDto) { return this.service.executive(query); }
  @Get("operations") operations(@Query() query: ReportQueryDto) { return this.service.operations(query); }
  @Get("incidents") incidents(@Query() query: IncidentsReportQueryDto) { return this.service.incidents(query); }
  @Get("transmission") transmission(@Query() query: ReportQueryDto) { return this.service.transmission(query); }
  @Get("workforce") workforce(@Query() query: ReportQueryDto) { return this.service.workforce(query); }
  @Get("logistics") logistics(@Query() query: ReportQueryDto) { return this.service.logistics(query); }
  @Get("assets") assets(@Query() query: ReportQueryDto) { return this.service.assets(query); }
  @Permissions(PERMISSIONS.reports.export) @Get("export.csv") async csv(@Query() query: ReportQueryDto, @Res() response: Response) { const content = await this.service.csv(query); response.setHeader("Content-Type", "text/csv; charset=utf-8"); response.setHeader("Content-Disposition", "attachment; filename=relatorio-election-ops.csv"); response.send(`\uFEFF${content}`); }
  @Permissions(PERMISSIONS.reports.export) @Get("export.pdf") async pdf(@Query() query: ReportQueryDto, @Res() response: Response) { const content = await this.service.pdf(query); response.setHeader("Content-Type", "application/pdf"); response.setHeader("Content-Disposition", "attachment; filename=relatorio-election-ops.pdf"); response.send(content); }
}
