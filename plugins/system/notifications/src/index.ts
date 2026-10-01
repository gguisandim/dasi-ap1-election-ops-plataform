import type { PlatformPlugin } from "@eops/plugin-sdk";
import { NotificationListPage } from "./client/pages/NotificationListPage";
import { manifest } from "./manifest";
export { NotificationBell } from "./client/components/NotificationBell";
export const notificationsPlugin: PlatformPlugin = { manifest, View: NotificationListPage, routes: [{ path: "/notifications", Component: NotificationListPage }] };
