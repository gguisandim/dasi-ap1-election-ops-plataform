import type { PlatformPlugin } from "@eops/plugin-sdk";
import { KnowledgeCategoriesPage } from "./client/pages/KnowledgeCategoriesPage";
import { KnowledgeCreatePage } from "./client/pages/KnowledgeCreatePage";
import { KnowledgeDetailPage } from "./client/pages/KnowledgeDetailPage";
import { KnowledgeEditPage } from "./client/pages/KnowledgeEditPage";
import { KnowledgeListPage } from "./client/pages/KnowledgeListPage";
import { KnowledgeMetricsPage } from "./client/pages/KnowledgeMetricsPage";
import { KnowledgeRecommendationsPage } from "./client/pages/KnowledgeRecommendationsPage";
import { KnowledgeVersionsPage } from "./client/pages/KnowledgeVersionsPage";
import { RunbookExecutionPage } from "./client/pages/RunbookExecutionPage";
import { manifest } from "./manifest";

export const knowledgeRunbooksPlugin: PlatformPlugin = {
  manifest,
  View: KnowledgeListPage,
  routes: [
    { path: "/knowledge", Component: KnowledgeListPage },
    { path: "/knowledge/new", Component: KnowledgeCreatePage },
    { path: "/knowledge/metrics", Component: KnowledgeMetricsPage },
    { path: "/knowledge/categories", Component: KnowledgeCategoriesPage },
    { path: "/knowledge/recommendations", Component: KnowledgeRecommendationsPage },
    { path: "/knowledge/:id/execute", Component: RunbookExecutionPage },
    { path: "/knowledge/:id/versions", Component: KnowledgeVersionsPage },
    { path: "/knowledge/:id/edit", Component: KnowledgeEditPage },
    { path: "/knowledge/:id", Component: KnowledgeDetailPage },
  ],
};

export { manifest } from "./manifest";
export { knowledgeService } from "./client/services/knowledgeService";
export type {
  KnowledgeFilters,
  KnowledgeMetrics,
  KnowledgeReferenceData,
  RecommendationQuery,
  UsageInput,
} from "./client/services/knowledgeService";
