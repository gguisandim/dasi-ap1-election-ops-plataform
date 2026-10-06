import type { PlatformPlugin } from "@eops/plugin-sdk";
import { electionsPlugin } from "@eops/plugin-elections";
import { pollingPlacesPlugin } from "@eops/plugin-polling-places";
import { electoralZonesPlugin } from "@eops/plugin-electoral-zones";
import { pollingSectionsPlugin } from "@eops/plugin-polling-sections";
import { operationalMapPlugin } from "@eops/plugin-operational-map";
import { routesPlugin } from "@eops/plugin-routes";
import { inventoryPlugin } from "@eops/plugin-inventory";
import { incidentsPlugin } from "@eops/plugin-incidents";
import { transmissionPlugin } from "@eops/plugin-transmission";
import { reportsPlugin } from "@eops/plugin-reports";
import { auditPlugin } from "@eops/plugin-audit";
import { accessControlPlugin } from "@eops/plugin-access-control";
import { notificationsPlugin } from "@eops/plugin-notifications";
import { operationalSimulatorPlugin } from "@eops/plugin-operational-simulator";
import { fieldTeamsPlugin } from "@eops/plugin-field-teams";
import { communicationsPlugin } from "@eops/plugin-communications";
import { documentsEvidencePlugin } from "@eops/plugin-documents-evidence";
import { knowledgeRunbooksPlugin } from "@eops/plugin-knowledge-runbooks";
import { riskManagementPlugin } from "@eops/plugin-risk-management";
import { shiftsPlugin } from "@eops/plugin-shifts";
import { shiftHandoversPlugin } from "@eops/plugin-shift-handovers";
import { preparationChecklistsPlugin } from "@eops/plugin-preparation-checklists";
import { tasksPlugin } from "@eops/plugin-tasks";
import { commandCenterPlugin } from "@eops/plugin-command-center";
import { resourceRequestsPlugin } from "@eops/plugin-resource-requests";
import { postmortemsPlugin } from "@eops/plugin-postmortems";

export const plugins: PlatformPlugin[] = [
  electionsPlugin,
  electoralZonesPlugin,
  pollingPlacesPlugin,
  pollingSectionsPlugin,
  fieldTeamsPlugin,
  communicationsPlugin,
  documentsEvidencePlugin,
  knowledgeRunbooksPlugin,
  riskManagementPlugin,
  shiftsPlugin,
  shiftHandoversPlugin,
  preparationChecklistsPlugin,
  tasksPlugin,
  resourceRequestsPlugin,
  postmortemsPlugin,
  routesPlugin,
  inventoryPlugin,
  incidentsPlugin,
  commandCenterPlugin,
  transmissionPlugin,
  operationalMapPlugin,
  reportsPlugin,
  auditPlugin,
  accessControlPlugin,
  notificationsPlugin,
  operationalSimulatorPlugin,
];
