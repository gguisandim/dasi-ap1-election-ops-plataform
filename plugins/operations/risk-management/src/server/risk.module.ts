import { Module } from "@nestjs/common";
import { RiskCatalogService } from "./risk-catalog.service";
import { RiskController } from "./risk.controller";
import { RiskMitigationService } from "./risk-mitigation.service";
import { RiskService } from "./risk.service";
import { RiskTimelineService } from "./risk-timeline.service";

@Module({
  controllers: [RiskController],
  providers: [RiskService, RiskMitigationService, RiskCatalogService, RiskTimelineService],
  exports: [RiskService],
})
export class RiskManagementModule {}
