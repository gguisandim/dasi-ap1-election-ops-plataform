/**
 * Contratos compartilhados do domínio de Base de Conhecimento e Runbooks.
 *
 * O plugin `@eops/plugin-knowledge-runbooks` é o dono destes tipos. Outros
 * domínios (Central de Incidentes, Centro de Comando) consomem apenas estes
 * contratos, nunca o service interno do plugin.
 */

export const KNOWLEDGE_KINDS = ["ARTICLE", "RUNBOOK"] as const;
export const KNOWLEDGE_STATUSES = ["DRAFT", "REVIEW", "PUBLISHED", "ARCHIVED"] as const;
export const RUNBOOK_OUTCOMES = ["RESOLVED", "PARTIALLY_RESOLVED", "NOT_RESOLVED"] as const;

export type KnowledgeArticleKind = (typeof KNOWLEDGE_KINDS)[number];
export type KnowledgeArticleStatus = (typeof KNOWLEDGE_STATUSES)[number];
export type RunbookUsageOutcome = (typeof RUNBOOK_OUTCOMES)[number];

export const KNOWLEDGE_KIND_LABELS: Record<KnowledgeArticleKind, string> = {
  ARTICLE: "Artigo",
  RUNBOOK: "Runbook",
};

export const KNOWLEDGE_STATUS_LABELS: Record<KnowledgeArticleStatus, string> = {
  DRAFT: "Rascunho",
  REVIEW: "Em revisão",
  PUBLISHED: "Publicado",
  ARCHIVED: "Arquivado",
};

export const RUNBOOK_OUTCOME_LABELS: Record<RunbookUsageOutcome, string> = {
  RESOLVED: "Resolvido",
  PARTIALLY_RESOLVED: "Parcialmente resolvido",
  NOT_RESOLVED: "Não resolvido",
};

/** Pesos do score de recomendação. Publicados para tornar a regra auditável. */
export const RUNBOOK_MATCH_WEIGHTS = {
  incidentCategory: 40,
  severity: 20,
  assetType: 15,
  keyword: 5,
  keywordCap: 25,
} as const;

/** Dias sem atualização a partir dos quais um runbook é considerado desatualizado. */
export const RUNBOOK_STALE_DAYS = 180;

export interface KnowledgeCategorySummary {
  id: string;
  key: string;
  name: string;
  description: string | null;
  color: string | null;
  active: boolean;
}

export interface KnowledgeTagSummary {
  id: string;
  label: string;
  slug: string;
  usageCount?: number;
}

export interface RunbookStepSummary {
  id: string;
  articleId: string;
  order: number;
  title: string;
  instruction: string;
  expected: string | null;
  required: boolean;
  warning: string | null;
  notes: string | null;
}

export interface KnowledgeArticleVersionSummary {
  id: string;
  articleId: string;
  number: number;
  title: string;
  summary: string;
  content: string | null;
  steps: unknown;
  note: string;
  authorName: string;
  createdAt: string;
}

export interface RunbookUsageSummary {
  id: string;
  articleId: string;
  incidentId: string | null;
  incidentCode: string | null;
  userId: string | null;
  userName: string;
  outcome: RunbookUsageOutcome;
  resolved: boolean;
  stepsCompleted: number | null;
  notes: string | null;
  startedAt: string;
  finishedAt: string | null;
  article?: Pick<KnowledgeArticleSummary, "id" | "code" | "title" | "kind">;
}

export interface KnowledgeArticleSummary {
  id: string;
  code: string;
  kind: KnowledgeArticleKind;
  title: string;
  summary: string;
  content: string | null;
  status: KnowledgeArticleStatus;
  categoryId: string | null;
  authorId: string | null;
  authorName: string;
  currentVersion: number;
  versionCount: number;
  views: number;
  usageCount: number;
  resolvedCount: number;
  incidentCategoryKey: string | null;
  incidentSeverity: string | null;
  assetTypeKey: string | null;
  keywords: string[];
  problem: string | null;
  symptoms: string | null;
  diagnosis: string | null;
  prerequisites: string | null;
  validation: string | null;
  rollback: string | null;
  escalation: string | null;
  references: string | null;
  publishedAt: string | null;
  reviewedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  category: KnowledgeCategorySummary | null;
  tags: KnowledgeTagSummary[];
  /** Taxa de sucesso derivada das execuções registradas. */
  successRate: number;
  /** Publicado sem atualização há mais de `RUNBOOK_STALE_DAYS`. */
  stale: boolean;
  stepCount?: number;
  steps?: RunbookStepSummary[];
  versions?: KnowledgeArticleVersionSummary[];
  timeline?: RunbookUsageSummary[];
}

export interface KnowledgeDashboard {
  total: number;
  articles: number;
  runbooks: number;
  published: number;
  drafts: number;
  review: number;
  archived: number;
  staleRunbooks: number;
  unusedPublished: number;
  totalUsages: number;
  successRate: number;
  /** Categorias ordenadas pela menor cobertura de runbooks publicados. */
  coverage: Array<{ categoryId: string | null; name: string; runbooks: number }>;
}

/** Componentes do score, expostos para que a recomendação seja explicável. */
export interface RunbookMatchBreakdown {
  incidentCategory: number;
  severity: number;
  assetType: number;
  keywords: number;
  matchedKeywords: string[];
}

export interface RunbookRecommendation {
  article: KnowledgeArticleSummary;
  score: number;
  breakdown: RunbookMatchBreakdown;
  reasons: string[];
}

export interface RunbookStepInput {
  order: number;
  title: string;
  instruction: string;
  expected?: string;
  required?: boolean;
  warning?: string;
  notes?: string;
}

export interface KnowledgeArticleInput {
  kind: KnowledgeArticleKind;
  title: string;
  summary: string;
  content?: string;
  categoryId?: string;
  tags: string[];
  incidentCategoryKey?: string;
  incidentSeverity?: string;
  assetTypeKey?: string;
  keywords: string[];
  problem?: string;
  symptoms?: string;
  diagnosis?: string;
  prerequisites?: string;
  validation?: string;
  rollback?: string;
  escalation?: string;
  references?: string;
  changeNote?: string;
}

export interface RunbookUsageInput {
  incidentId?: string;
  incidentCode?: string;
  outcome: RunbookUsageOutcome;
  stepsCompleted?: number;
  notes?: string;
  finishedAt?: string;
}
