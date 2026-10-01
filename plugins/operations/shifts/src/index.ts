import type { PlatformPlugin } from "@eops/plugin-sdk";
import { manifest } from "./manifest";
import { NewShiftPage } from "./client/pages/NewShiftPage";
import { ShiftDetailPage } from "./client/pages/ShiftDetailPage";
import { ShiftsDashboardPage } from "./client/pages/ShiftsDashboardPage";
import { ShiftsListPage } from "./client/pages/ShiftsListPage";

export const shiftsPlugin: PlatformPlugin = {
  manifest,
  View: ShiftsDashboardPage,
  routes: [
    { path: "/shifts", Component: ShiftsDashboardPage },
    { path: "/shifts/list", Component: ShiftsListPage },
    { path: "/shifts/new", Component: NewShiftPage },
    { path: "/shifts/:id", Component: ShiftDetailPage },
  ],
};
