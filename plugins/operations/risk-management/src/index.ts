import type { PlatformPlugin } from "@eops/plugin-sdk";
import { RiskCategoriesPage } from "./client/pages/RiskCategoriesPage";
import { RiskCreatePage } from "./client/pages/RiskCreatePage";
import { RiskDashboardPage } from "./client/pages/RiskDashboardPage";
import { RiskDetailPage } from "./client/pages/RiskDetailPage";
import { RiskEditPage } from "./client/pages/RiskEditPage";
import { RiskListPage } from "./client/pages/RiskListPage";
import { RiskMatrixPage } from "./client/pages/RiskMatrixPage";
import { manifest } from "./manifest";

export const riskManagementPlugin: PlatformPlugin = {
  manifest,
  View: RiskDashboardPage,
  routes: [
    { path: "/risks", Component: RiskDashboardPage },
    { path: "/risks/list", Component: RiskListPage },
    { path: "/risks/new", Component: RiskCreatePage },
    { path: "/risks/matrix", Component: RiskMatrixPage },
    { path: "/risks/categories", Component: RiskCategoriesPage },
    { path: "/risks/:id/edit", Component: RiskEditPage },
    { path: "/risks/:id", Component: RiskDetailPage },
  ],
};

export { manifest } from "./manifest";
export { riskService } from "./client/services/riskService";
export type {
  MaterializeInput,
  RiskFilters,
  RiskReferenceData,
} from "./client/services/riskService";
