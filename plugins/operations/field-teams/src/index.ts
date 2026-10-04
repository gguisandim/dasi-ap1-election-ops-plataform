import type { PlatformPlugin } from "@eops/plugin-sdk";
import { manifest } from "./manifest";
import { AllocationsPage } from "./client/pages/AllocationsPage";
import { ChecksPage } from "./client/pages/ChecksPage";
import { FieldDashboardPage } from "./client/pages/FieldDashboardPage";
import { MembersPage } from "./client/pages/MembersPage";
import { MemberDetailPage } from "./client/pages/MemberDetailPage";
import { ShiftsPage } from "./client/pages/ShiftsPage";
import { TeamDetailPage } from "./client/pages/TeamDetailPage";
import { TeamsPage } from "./client/pages/TeamsPage";

export const fieldTeamsPlugin: PlatformPlugin = {
  manifest,
  View: FieldDashboardPage,
  routes: [
    { path: "/field-teams", Component: FieldDashboardPage },
    { path: "/field-teams/teams", Component: TeamsPage },
    { path: "/field-teams/teams/:id", Component: TeamDetailPage },
    { path: "/field-teams/members", Component: MembersPage },
    { path: "/field-teams/members/:id", Component: MemberDetailPage },
    { path: "/field-teams/shifts", Component: ShiftsPage },
    { path: "/field-teams/allocations", Component: AllocationsPage },
    { path: "/field-teams/checks", Component: ChecksPage },
  ],
};
