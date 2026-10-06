import { Module } from "@nestjs/common";
import { DatabaseModule } from "@eops/database";
import { HealthController } from "./health.controller";
import { EventBusModule } from "@eops/event-bus";
import { ReportsModule } from "@eops/plugin-reports/server";
import { InventoryModule } from "@eops/plugin-inventory/server";
import { RoutesModule } from "@eops/plugin-routes/server";
import { IncidentsModule } from "@eops/plugin-incidents/server";
import { TransmissionModule } from "@eops/plugin-transmission/server";
import { CommunicationsModule } from "@eops/plugin-communications/server";
import { DocumentsEvidenceModule } from "@eops/plugin-documents-evidence/server";
import { ElectionsModule } from "@eops/plugin-elections/server";
import { ElectoralZonesModule } from "@eops/plugin-electoral-zones/server";
import { FieldTeamsModule } from "@eops/plugin-field-teams/server";
import { KnowledgeRunbooksModule } from "@eops/plugin-knowledge-runbooks/server";
import { PollingPlacesModule } from "@eops/plugin-polling-places/server";
import { PollingSectionsModule } from "@eops/plugin-polling-sections/server";
import { PreparationChecklistsModule } from "@eops/plugin-preparation-checklists/server";
import { RiskManagementModule } from "@eops/plugin-risk-management/server";
import { ShiftsModule } from "@eops/plugin-shifts/server";
import { ShiftHandoversModule } from "@eops/plugin-shift-handovers/server";
import { TasksModule } from "@eops/plugin-tasks/server";
import { SimulatorModule } from "@eops/plugin-operational-simulator/server";
import { OperationalMapModule } from "@eops/plugin-operational-map/server";
import { AccessControlModule } from "@eops/plugin-access-control/server";
import { AuditModule } from "@eops/plugin-audit/server";
import { NotificationsModule } from "@eops/plugin-notifications/server";

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
    OperationalMapModule,
    RoutesModule,
    TransmissionModule,
    ReportsModule,
    FieldTeamsModule,
    CommunicationsModule,
    DocumentsEvidenceModule,
    KnowledgeRunbooksModule,
    RiskManagementModule,
    ShiftsModule,
    ShiftHandoversModule,
    PreparationChecklistsModule,
    TasksModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
