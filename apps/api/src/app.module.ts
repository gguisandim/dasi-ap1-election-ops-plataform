import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../../packages/database/src";
import { HealthController } from "./health.controller";
import { ElectionsModule } from "../../../plugins/operations/elections/src/server/elections.module";
import { ElectoralZonesModule } from "../../../plugins/operations/electoral-zones/src/server/electoral-zones.module";
import { PollingPlacesModule } from "../../../plugins/operations/polling-places/src/server/polling-places.module";
import { PollingSectionsModule } from "../../../plugins/operations/polling-sections/src/server/polling-sections.module";
import { IncidentsModule } from "../../../plugins/monitoring/incidents/src/server/incidents.module";
import { InventoryModule } from "../../../plugins/logistics/inventory/src/server/inventory.module";
import { AccessControlModule } from "../../../plugins/system/access-control/src/server/access-control.module";
import { AuditModule } from "../../../plugins/system/audit/src/server/audit.module";
import { EventBusModule } from "../../../packages/event-bus/src";
import { NotificationsModule } from "../../../plugins/system/notifications/src/server/notifications.module";
import { SimulatorModule } from "../../../plugins/simulation/operational-simulator/src/server/simulator.module";
import { RoutesModule } from "../../../plugins/logistics/routes/src/server/routes.module";
import { TransmissionModule } from "../../../plugins/monitoring/transmission/src/server/transmission.module";
import { ReportsModule } from "../../../plugins/analytics/reports/src/server/reports.module";
import { FieldTeamsModule } from "../../../plugins/operations/field-teams/src/server/field-teams.module";
import { CommunicationsModule } from "../../../plugins/operations/communications/src/server/communications.module";
import { DocumentsEvidenceModule } from "../../../plugins/operations/documents-evidence/src/server/evidence.module";
import { KnowledgeRunbooksModule } from "../../../plugins/operations/knowledge-runbooks/src/server/knowledge.module";

@Module({
  imports: [
    DatabaseModule,
    EventBusModule,
    ElectionsModule,
    ElectoralZonesModule,
    PollingPlacesModule,
    PollingSectionsModule,
    IncidentsModule,
    InventoryModule,
    AccessControlModule,
    AuditModule,
    NotificationsModule,
    SimulatorModule,
    RoutesModule,
    TransmissionModule,
    ReportsModule,
    FieldTeamsModule,
    CommunicationsModule,
    DocumentsEvidenceModule,
    KnowledgeRunbooksModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
