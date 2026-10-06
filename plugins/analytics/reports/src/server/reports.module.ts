import { Module } from "@nestjs/common";
import { ReportsController } from "./reports.controller";
import { ReportsService } from "./reports.service";
import { ReportsViewsService } from "./reports-views.service";

@Module({ controllers: [ReportsController], providers: [ReportsService, ReportsViewsService], exports: [ReportsService] })
export class ReportsModule {}
