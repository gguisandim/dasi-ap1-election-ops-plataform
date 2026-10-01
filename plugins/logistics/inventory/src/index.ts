import type { PlatformPlugin } from "@eops/plugin-sdk";
import { AssetDetailPage } from "./client/pages/AssetDetailPage";
import { AssetFormPage } from "./client/pages/AssetFormPage";
import { AssetListPage } from "./client/pages/AssetListPage";
import { AssetMovePage } from "./client/pages/AssetMovePage";
import { AssetTypesPage } from "./client/pages/AssetTypesPage";
import { manifest } from "./manifest";

export const inventoryPlugin: PlatformPlugin = {
  manifest,
  View: AssetListPage,
  routes: [
    { path: "/inventory", Component: AssetListPage },
    { path: "/inventory/new", Component: AssetFormPage },
    { path: "/inventory/types", Component: AssetTypesPage },
    { path: "/inventory/:id/edit", Component: AssetFormPage },
    { path: "/inventory/:id/move", Component: AssetMovePage },
    { path: "/inventory/:id", Component: AssetDetailPage },
  ],
};
