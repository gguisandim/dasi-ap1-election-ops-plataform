import type { PlatformPlugin } from "@eops/plugin-sdk";
import { manifest } from "./manifest";
import { ChecklistDetailPage } from "./client/pages/ChecklistDetailPage";
import { ChecklistsPage } from "./client/pages/ChecklistsPage";
import { NewChecklistPage } from "./client/pages/NewChecklistPage";
import { PreparationDashboardPage } from "./client/pages/PreparationDashboardPage";
import { TemplatesPage } from "./client/pages/TemplatesPage";

export const preparationChecklistsPlugin: PlatformPlugin = {
  manifest,
  View: PreparationDashboardPage,
  routes: [
    { path: "/preparation-checklists", Component: PreparationDashboardPage },
    { path: "/preparation-checklists/list", Component: ChecklistsPage },
    { path: "/preparation-checklists/new", Component: NewChecklistPage },
    { path: "/preparation-checklists/:id", Component: ChecklistDetailPage },
    { path: "/preparation-checklists/templates", Component: TemplatesPage },
  ],
};