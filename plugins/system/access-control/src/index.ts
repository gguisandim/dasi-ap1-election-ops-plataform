import type { PlatformPlugin } from "@eops/plugin-sdk";
import { RoleDetailPage } from "./client/pages/RoleDetailPage";
import { RoleMatrixPage } from "./client/pages/RoleMatrixPage";
import { RolesListPage } from "./client/pages/RolesListPage";
import { UserDetailPage } from "./client/pages/UserDetailPage";
import { UsersListPage } from "./client/pages/UsersListPage";
import { manifest } from "./manifest";
export { AuthProvider, useAuth } from "./client/AuthContext";
export { LoginPage } from "./client/pages/LoginPage";
export const accessControlPlugin: PlatformPlugin = {
  manifest,
  View: UsersListPage,
  routes: [
    { path: "/users", Component: UsersListPage },
    { path: "/users/:id", Component: UserDetailPage },
    { path: "/roles", Component: RolesListPage },
    { path: "/roles/matrix", Component: RoleMatrixPage },
    { path: "/roles/:id", Component: RoleDetailPage },
  ],
};
