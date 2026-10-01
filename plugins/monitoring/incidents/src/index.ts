import type { PlatformPlugin } from "@eops/plugin-sdk";
import { IncidentDetailPage } from "./client/pages/IncidentDetailPage";
import { IncidentFormPage } from "./client/pages/IncidentFormPage";
import { IncidentListPage } from "./client/pages/IncidentListPage";
import { manifest } from "./manifest";

export const incidentsPlugin: PlatformPlugin = {
  manifest,
  View: IncidentListPage,
  routes: [
    { path: "/incidents", Component: IncidentListPage },
    { path: "/incidents/new", Component: IncidentFormPage },
    { path: "/incidents/:id/edit", Component: IncidentFormPage },
    { path: "/incidents/:id", Component: IncidentDetailPage },
  ],
};
