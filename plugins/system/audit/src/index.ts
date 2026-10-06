import type { PlatformPlugin } from "@eops/plugin-sdk";
import { AuditListPage } from "./client/pages/AuditListPage";
import { AuditDetailPage } from "./client/pages/AuditDetailPage";
import { AuditEntityPage } from "./client/pages/AuditEntityPage";
import { AuditCorrelationPage } from "./client/pages/AuditCorrelationPage";
import { manifest } from "./manifest";
export const auditPlugin: PlatformPlugin = {
  manifest,
  View: AuditListPage,
  routes: [
    { path: "/audit", Component: AuditListPage },
    { path: "/audit/entities/:type/:id", Component: AuditEntityPage },
    { path: "/audit/correlation/:id", Component: AuditCorrelationPage },
    { path: "/audit/:id", Component: AuditDetailPage },
  ],
};
