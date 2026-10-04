import type { PlatformPlugin } from "@eops/plugin-sdk";
import { AuditListPage } from "./client/pages/AuditListPage";
import { AuditDetailPage } from "./client/pages/AuditDetailPage";
import { manifest } from "./manifest";
export const auditPlugin: PlatformPlugin = { manifest, View: AuditListPage, routes: [{ path: "/audit", Component: AuditListPage }, { path: "/audit/:id", Component: AuditDetailPage }] };
