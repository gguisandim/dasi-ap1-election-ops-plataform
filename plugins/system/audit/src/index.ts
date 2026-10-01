import type { PlatformPlugin } from "@eops/plugin-sdk";
import { AuditListPage } from "./client/pages/AuditListPage";
import { manifest } from "./manifest";
export const auditPlugin: PlatformPlugin = { manifest, View: AuditListPage, routes: [{ path: "/audit", Component: AuditListPage }] };
