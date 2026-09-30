import type { PlatformPlugin } from "@eops/plugin-sdk";
import { manifest } from "./manifest";
import { ElectionListPage } from "./client/pages/ElectionListPage";
import { ElectionDetailPage } from "./client/pages/ElectionDetailPage";
import { ElectionFormPage } from "./client/pages/ElectionFormPage";

export const electionsPlugin: PlatformPlugin = {
  manifest,
  View: ElectionListPage,
  routes: [
    { path: "/elections", Component: ElectionListPage },
    { path: "/elections/new", Component: ElectionFormPage },
    { path: "/elections/:id/edit", Component: ElectionFormPage },
    { path: "/elections/:id", Component: ElectionDetailPage },
  ],
};
