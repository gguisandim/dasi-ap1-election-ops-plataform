import type {
  KnowledgeArticleKind,
  KnowledgeArticleStatus,
  RunbookUsageOutcome,
} from "@eops/shared/knowledge";

export type Tone = "neutral" | "success" | "warning" | "danger" | "info";

export const KIND_ICONS: Record<KnowledgeArticleKind, string> = {
  ARTICLE: "▤",
  RUNBOOK: "❖",
};

export const STATUS_TONES: Record<KnowledgeArticleStatus, Tone> = {
  DRAFT: "neutral",
  REVIEW: "warning",
  PUBLISHED: "success",
  ARCHIVED: "neutral",
};

export const OUTCOME_TONES: Record<RunbookUsageOutcome, Tone> = {
  RESOLVED: "success",
  PARTIALLY_RESOLVED: "warning",
  NOT_RESOLVED: "danger",
};

/** Cor da barra de progresso da execução, conforme o avanço dos passos. */
export function progressTone(progress: number): string {
  if (progress >= 100) return "success";
  if (progress >= 50) return "info";
  if (progress > 0) return "warning";
  return "neutral";
}

/** `"incidentes de rede no plantão"` → termos usados como palavras-chave. */
export function keywordsFromText(value: string): string[] {
  return [
    ...new Set(
      value
        .normalize("NFD")
        .replace(/\p{M}/gu, "")
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((token) => token.length >= 3),
    ),
  ].slice(0, 20);
}
