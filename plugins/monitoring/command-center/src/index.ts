import type { PlatformPlugin } from "@eops/plugin-sdk";
import { AttentionPage } from "./client/pages/AttentionPage";
import { CommandCenterPage } from "./client/pages/CommandCenterPage";
import { SnapshotsPage } from "./client/pages/SnapshotsPage";
import { ViewsPage } from "./client/pages/ViewsPage";
import { ZonesPage } from "./client/pages/ZonesPage";
import { manifest } from "./manifest";

export const commandCenterPlugin: PlatformPlugin = {
  manifest,
  View: CommandCenterPage,
  routes: [
    { path: "/command-center", Component: CommandCenterPage },
    { path: "/command-center/attention", Component: AttentionPage },
    { path: "/command-center/zones", Component: ZonesPage },
    { path: "/command-center/views", Component: ViewsPage },
    { path: "/command-center/snapshots", Component: SnapshotsPage },
  ],
};
