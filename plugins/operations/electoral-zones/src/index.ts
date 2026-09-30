import type { PlatformPlugin } from "@eops/plugin-sdk";
import { manifest } from "./manifest";
import { ZoneListPage } from "./client/pages/ZoneListPage";
import { ZoneDetailPage } from "./client/pages/ZoneDetailPage";
import { ZoneFormPage } from "./client/pages/ZoneFormPage";
export const electoralZonesPlugin: PlatformPlugin = {
  manifest,
  View: ZoneListPage,
  routes: [
    { path: "/electoral-zones", Component: ZoneListPage },
    { path: "/electoral-zones/new", Component: ZoneFormPage },
    { path: "/electoral-zones/:id/edit", Component: ZoneFormPage },
    { path: "/electoral-zones/:id", Component: ZoneDetailPage },
  ],
};
