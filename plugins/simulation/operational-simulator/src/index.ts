import type { PlatformPlugin } from "@eops/plugin-sdk";
import { ComparePage } from "./client/pages/ComparePage";
import { ReplayPage } from "./client/pages/ReplayPage";
import { RunsPage } from "./client/pages/RunsPage";
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
    { path: "/simulator/compare", Component: ComparePage },
    { path: "/simulator/runs", Component: RunsPage },
    { path: "/simulator/runs/:id", Component: SimulationDetailPage },
    { path: "/simulator/runs/:id/replay", Component: ReplayPage },
    { path: "/simulator/scenarios", Component: ScenariosPage },
    { path: "/simulator/scenarios/new", Component: ScenarioBuilderPage },
    { path: "/simulator/scenarios/:id", Component: ScenarioBuilderPage },
  ],
};
