import type { PlatformPlugin } from "@eops/plugin-sdk";
import { manifest } from "./manifest";
import { NewShiftPage } from "./client/pages/NewShiftPage";
import { ShiftDetailPage } from "./client/pages/ShiftDetailPage";
import { ShiftsDashboardPage } from "./client/pages/ShiftsDashboardPage";
import { ShiftsListPage } from "./client/pages/ShiftsListPage";
import { ShiftsCalendarPage } from "./client/pages/ShiftsCalendarPage";
import { ShiftCoveragePage } from "./client/pages/ShiftCoveragePage";
import { ShiftTemplatesPage } from "./client/pages/ShiftTemplatesPage";

export const shiftsPlugin: PlatformPlugin = {
  manifest,
  View: ShiftsDashboardPage,
  routes: [
    { path: "/shifts", Component: ShiftsDashboardPage },
    { path: "/shifts/list", Component: ShiftsListPage },
    { path: "/shifts/calendar", Component: ShiftsCalendarPage },
    { path: "/shifts/coverage", Component: ShiftCoveragePage },
    { path: "/shifts/templates", Component: ShiftTemplatesPage },
    { path: "/shifts/new", Component: NewShiftPage },
    { path: "/shifts/:id", Component: ShiftDetailPage },
  ],
};
