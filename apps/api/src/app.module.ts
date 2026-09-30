import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../../packages/database/src";
import { HealthController } from "./health.controller";
import { ElectionsModule } from "../../../plugins/operations/elections/src/server/elections.module";
import { ElectoralZonesModule } from "../../../plugins/operations/electoral-zones/src/server/electoral-zones.module";
import { PollingPlacesModule } from "../../../plugins/operations/polling-places/src/server/polling-places.module";
import { PollingSectionsModule } from "../../../plugins/operations/polling-sections/src/server/polling-sections.module";

@Module({
  imports: [
    DatabaseModule,
    ElectionsModule,
    ElectoralZonesModule,
    PollingPlacesModule,
    PollingSectionsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
