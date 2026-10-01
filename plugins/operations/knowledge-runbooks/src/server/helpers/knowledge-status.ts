import { KnowledgeArticleStatus } from "@prisma/client";

/** Máquina de estados de artigos e runbooks. `ARCHIVED` é terminal. */
export const KNOWLEDGE_TRANSITIONS: Record<KnowledgeArticleStatus, KnowledgeArticleStatus[]> = {
  DRAFT: [KnowledgeArticleStatus.REVIEW, KnowledgeArticleStatus.PUBLISHED, KnowledgeArticleStatus.ARCHIVED],
  REVIEW: [KnowledgeArticleStatus.DRAFT, KnowledgeArticleStatus.PUBLISHED, KnowledgeArticleStatus.ARCHIVED],
  PUBLISHED: [KnowledgeArticleStatus.ARCHIVED],
  ARCHIVED: [],
};

export function canTransition(
  from: KnowledgeArticleStatus,
  to: KnowledgeArticleStatus,
): boolean {
  if (from === to) return false;
  return KNOWLEDGE_TRANSITIONS[from].includes(to);
}

export function transitionError(
  from: KnowledgeArticleStatus,
  to: KnowledgeArticleStatus,
): string {
  return `Transição de ${from} para ${to} não permitida.`;
}

/** Somente publicado é recomendável, pesquisável como solução e executável. */
export function isPublished(status: KnowledgeArticleStatus): boolean {
  return status === KnowledgeArticleStatus.PUBLISHED;
}

/** Versão é criada sem nota obrigatória enquanto o conteúdo nunca foi publicado. */
export function requiresChangeNote(status: KnowledgeArticleStatus): boolean {
  return status !== KnowledgeArticleStatus.DRAFT;
}

export function isStale(updatedAt: Date, staleDays: number, now: Date = new Date()): boolean {
  const limit = now.getTime() - staleDays * 86_400_000;
  return updatedAt.getTime() < limit;
}
