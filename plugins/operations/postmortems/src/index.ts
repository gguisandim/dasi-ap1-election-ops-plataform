import type { PlatformPlugin } from "@eops/plugin-sdk";
import { PostmortemDashboardPage } from "./client/pages/PostmortemDashboardPage";
import { PostmortemDetailPage } from "./client/pages/PostmortemDetailPage";
import { PostmortemFormPage } from "./client/pages/PostmortemFormPage";
import { PostmortemInsightsPage } from "./client/pages/PostmortemInsightsPage";
import { PostmortemListPage } from "./client/pages/PostmortemListPage";
import { PostmortemTimelinePage } from "./client/pages/PostmortemTimelinePage";
import { manifest } from "./manifest";

export const postmortemsPlugin: PlatformPlugin = {
  manifest,
  View: PostmortemDashboardPage,
  routes: [
    { path: "/postmortems", Component: PostmortemListPage },
    { path: "/postmortems/dashboard", Component: PostmortemDashboardPage },
    { path: "/postmortems/new", Component: PostmortemFormPage },
    { path: "/postmortems/insights", Component: PostmortemInsightsPage },
    { path: "/postmortems/:id/timeline", Component: PostmortemTimelinePage },
    // O editor estruturado vive no próprio detalhe: a rota de edição aponta para
    // a mesma tela, que habilita as seções apenas quando o status permite.
    { path: "/postmortems/:id/edit", Component: PostmortemDetailPage },
    { path: "/postmortems/:id", Component: PostmortemDetailPage },
  ],
};
