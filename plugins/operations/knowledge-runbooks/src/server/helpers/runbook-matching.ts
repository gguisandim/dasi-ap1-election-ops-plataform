import { RUNBOOK_MATCH_WEIGHTS } from "@eops/shared/knowledge";
import type { RunbookMatchBreakdown } from "@eops/shared/knowledge";

/**
 * Contexto de um incidente (ou de uma consulta avulsa) usado para recomendar
 * runbooks. Mantido como dado simples para que o cálculo seja testável sem banco.
 */
export interface MatchContext {
  categoryKey?: string | null;
  severity?: string | null;
  assetTypeKey?: string | null;
  /** Texto livre: título e descrição do incidente. */
  text?: string | null;
}

/** Runbook candidato, reduzido ao que o score precisa. */
export interface MatchCandidate {
  incidentCategoryKey?: string | null;
  incidentSeverity?: string | null;
  assetTypeKey?: string | null;
  keywords: string[];
}

const EMPTY: RunbookMatchBreakdown = {
  incidentCategory: 0,
  severity: 0,
  assetType: 0,
  keywords: 0,
  matchedKeywords: [],
};

const STOP_WORDS = new Set([
  "a", "ao", "aos", "as", "com", "da", "das", "de", "do", "dos", "e", "em", "na",
  "nas", "no", "nos", "o", "os", "para", "por", "que", "sem", "um", "uma",
]);

const DIACRITICS = /\p{M}/gu;

/** Normaliza um texto para comparação: sem acento, minúsculo, só alfanumérico. */
export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(DIACRITICS, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Extrai termos relevantes de um texto livre, descartando palavras vazias. */
export function tokenize(value: string | null | undefined): string[] {
  if (!value) return [];
  return [
    ...new Set(
      normalizeText(value)
        .split(" ")
        .filter((token) => token.length >= 3 && !STOP_WORDS.has(token)),
    ),
  ];
}

/**
 * Score de recomendação — regra publicada, determinística e explicável.
 *
 * ```text
 * categoria de incidente igual ....... 40
 * severidade igual ................... 20
 * tipo de ativo igual ................ 15
 * palavra-chave presente no texto ....  5 por palavra (máx. 25)
 * ```
 *
 * Um runbook sem nenhum critério em comum pontua zero e é descartado pelo
 * serviço, que só devolve resultados com score positivo.
 */
export function scoreRunbook(
  context: MatchContext,
  candidate: MatchCandidate,
): { score: number; breakdown: RunbookMatchBreakdown; reasons: string[] } {
  const breakdown: RunbookMatchBreakdown = { ...EMPTY, matchedKeywords: [] };
  const reasons: string[] = [];

  if (
    context.categoryKey &&
    candidate.incidentCategoryKey &&
    context.categoryKey === candidate.incidentCategoryKey
  ) {
    breakdown.incidentCategory = RUNBOOK_MATCH_WEIGHTS.incidentCategory;
    reasons.push(`Mesma categoria de incidente (${context.categoryKey}).`);
  }

  if (
    context.severity &&
    candidate.incidentSeverity &&
    context.severity === candidate.incidentSeverity
  ) {
    breakdown.severity = RUNBOOK_MATCH_WEIGHTS.severity;
    reasons.push(`Severidade alvo ${context.severity}.`);
  }

  if (
    context.assetTypeKey &&
    candidate.assetTypeKey &&
    context.assetTypeKey === candidate.assetTypeKey
  ) {
    breakdown.assetType = RUNBOOK_MATCH_WEIGHTS.assetType;
    reasons.push(`Mesmo tipo de ativo (${context.assetTypeKey}).`);
  }

  const haystack = new Set(tokenize(context.text));
  if (haystack.size > 0 && candidate.keywords.length > 0) {
    const matched = candidate.keywords
      .map((keyword) => normalizeText(keyword))
      .filter((keyword) => keyword.length >= 3 && haystack.has(keyword));
    breakdown.matchedKeywords = [...new Set(matched)];
    breakdown.keywords = Math.min(
      breakdown.matchedKeywords.length * RUNBOOK_MATCH_WEIGHTS.keyword,
      RUNBOOK_MATCH_WEIGHTS.keywordCap,
    );
    if (breakdown.matchedKeywords.length > 0) {
      reasons.push(`Palavras-chave presentes no incidente: ${breakdown.matchedKeywords.join(", ")}.`);
    }
  }

  const score =
    breakdown.incidentCategory + breakdown.severity + breakdown.assetType + breakdown.keywords;
  return { score, breakdown, reasons };
}

/**
 * Ordenação determinística: score desc, quem já resolveu desc, taxa de sucesso
 * desc, mais usado desc e, por último, título em ordem alfabética — de modo que
 * dois runbooks equivalentes nunca alternem de posição entre execuções.
 */
export function compareRecommendations(
  left: { score: number; resolvedCount: number; successRate: number; usageCount: number; title: string },
  right: { score: number; resolvedCount: number; successRate: number; usageCount: number; title: string },
): number {
  if (right.score !== left.score) return right.score - left.score;
  if (right.resolvedCount !== left.resolvedCount) return right.resolvedCount - left.resolvedCount;
  if (right.successRate !== left.successRate) return right.successRate - left.successRate;
  if (right.usageCount !== left.usageCount) return right.usageCount - left.usageCount;
  return left.title.localeCompare(right.title, "pt-BR");
}

/** Taxa de sucesso em pontos percentuais, com uma casa decimal. */
export function successRate(resolvedCount: number, usageCount: number): number {
  if (usageCount <= 0) return 0;
  return Math.round((resolvedCount / usageCount) * 1000) / 10;
}
