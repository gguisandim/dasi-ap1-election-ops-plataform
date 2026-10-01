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
import { shiftsPlugin } from "@eops/plugin-shifts";
import { preparationChecklistsPlugin } from "@eops/plugin-preparation-checklists";
import { tasksPlugin } from "@eops/plugin-tasks";

export const plugins: PlatformPlugin[] = [
  electionsPlugin,
  electoralZonesPlugin,
  pollingPlacesPlugin,
  pollingSectionsPlugin,
  fieldTeamsPlugin,
  shiftsPlugin,
  preparationChecklistsPlugin,
  tasksPlugin,
  routesPlugin,
  inventoryPlugin,
  incidentsPlugin,
  transmissionPlugin,
  operationalMapPlugin,
  reportsPlugin,
  auditPlugin,
  accessControlPlugin,
  notificationsPlugin,
  operationalSimulatorPlugin,
];
