import type { PlatformPlugin } from "@eops/plugin-sdk";
import { SimulationDetailPage } from "./client/pages/SimulationDetailPage";
import { SimulatorPage } from "./client/pages/SimulatorPage";
import { manifest } from "./manifest";
export const operationalSimulatorPlugin: PlatformPlugin = { manifest, View: SimulatorPage, routes: [{ path: "/simulator", Component: SimulatorPage }, { path: "/simulator/:id", Component: SimulationDetailPage }] };
