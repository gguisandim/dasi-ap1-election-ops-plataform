import type { PlatformPlugin } from "@eops/plugin-sdk";
import { IncidentDetailPage } from "./client/pages/IncidentDetailPage";
import { IncidentCategoriesPage } from "./client/pages/IncidentCategoriesPage";
import { IncidentFormPage } from "./client/pages/IncidentFormPage";
import { IncidentListPage } from "./client/pages/IncidentListPage";
import { IncidentQueuePage } from "./client/pages/IncidentQueuePage";
import { manifest } from "./manifest";

export const incidentsPlugin: PlatformPlugin = {
  manifest,
  View: IncidentListPage,
  routes: [
    { path: "/incidents", Component: IncidentListPage },
    { path: "/incidents/queue", Component: IncidentQueuePage },
    { path: "/incidents/categories", Component: IncidentCategoriesPage },
    { path: "/incidents/new", Component: IncidentFormPage },
    { path: "/incidents/:id/edit", Component: IncidentFormPage },
    { path: "/incidents/:id", Component: IncidentDetailPage },
  ],
};
