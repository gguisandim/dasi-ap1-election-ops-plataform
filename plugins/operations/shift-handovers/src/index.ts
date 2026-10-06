import type { PlatformPlugin } from "@eops/plugin-sdk";
import { HandoverDashboardPage } from "./client/pages/HandoverDashboardPage";
import { HandoverDetailPage } from "./client/pages/HandoverDetailPage";
import { HandoverFormPage } from "./client/pages/HandoverFormPage";
import { HandoverListPage } from "./client/pages/HandoverListPage";
import { manifest } from "./manifest";

export const shiftHandoversPlugin: PlatformPlugin = {
  manifest,
  View: HandoverDashboardPage,
  routes: [
    { path: "/shift-handovers", Component: HandoverDashboardPage },
    { path: "/shift-handovers/list", Component: HandoverListPage },
    { path: "/shift-handovers/new", Component: HandoverFormPage },
    { path: "/shift-handovers/:id/edit", Component: HandoverFormPage },
    { path: "/shift-handovers/:id", Component: HandoverDetailPage },
  ],
};
