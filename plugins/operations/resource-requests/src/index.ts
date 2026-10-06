import type { PlatformPlugin } from "@eops/plugin-sdk";
import { RequestDashboardPage } from "./client/pages/RequestDashboardPage";
import { RequestDetailPage } from "./client/pages/RequestDetailPage";
import { RequestFormPage } from "./client/pages/RequestFormPage";
import { RequestListPage } from "./client/pages/RequestListPage";
import { RequestQueuePage } from "./client/pages/RequestQueuePage";
import { manifest } from "./manifest";

export const resourceRequestsPlugin: PlatformPlugin = {
  manifest,
  View: RequestDashboardPage,
  routes: [
    { path: "/resource-requests", Component: RequestDashboardPage },
    { path: "/resource-requests/dashboard", Component: RequestDashboardPage },
    { path: "/resource-requests/queue", Component: RequestQueuePage },
    { path: "/resource-requests/list", Component: RequestListPage },
    { path: "/resource-requests/new", Component: RequestFormPage },
    { path: "/resource-requests/:id/edit", Component: RequestFormPage },
    { path: "/resource-requests/:id", Component: RequestDetailPage },
  ],
};
