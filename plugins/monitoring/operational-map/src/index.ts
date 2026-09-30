import "leaflet/dist/leaflet.css";
import type { PlatformPlugin } from "@eops/plugin-sdk";
import { manifest } from "./manifest";
import { OperationalMapPage } from "./client/pages/OperationalMapPage";
export const operationalMapPlugin: PlatformPlugin = {
  manifest,
  View: OperationalMapPage,
  routes: [{ path: "/map", Component: OperationalMapPage }],
};
