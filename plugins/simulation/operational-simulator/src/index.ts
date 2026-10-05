import type { PlatformPlugin } from "@eops/plugin-sdk";
import { ScenarioBuilderPage } from "./client/pages/ScenarioBuilderPage";
import { ScenariosPage } from "./client/pages/ScenariosPage";
import { SimulationDetailPage } from "./client/pages/SimulationDetailPage";
import { SimulatorPage } from "./client/pages/SimulatorPage";
import { manifest } from "./manifest";
export const operationalSimulatorPlugin: PlatformPlugin = {
  manifest,
  View: SimulatorPage,
  routes: [
    { path: "/simulator", Component: SimulatorPage },
    { path: "/simulator/scenarios", Component: ScenariosPage },
    { path: "/simulator/scenarios/new", Component: ScenarioBuilderPage },
    { path: "/simulator/scenarios/:id", Component: ScenarioBuilderPage },
    { path: "/simulator/:id", Component: SimulationDetailPage },
  ],
};
