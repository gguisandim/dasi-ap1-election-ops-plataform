import type { PlatformPlugin } from "@eops/plugin-sdk";
import { UserListPage } from "./client/pages/UserListPage";
import { manifest } from "./manifest";
export { AuthProvider, useAuth } from "./client/AuthContext";
export { LoginPage } from "./client/pages/LoginPage";
export const accessControlPlugin: PlatformPlugin = { manifest, View: UserListPage, routes: [{ path: "/users", Component: UserListPage }] };
