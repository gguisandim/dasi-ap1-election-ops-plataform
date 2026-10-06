/**
 * Contratos e regras puras do domínio de postmortem / RCA.
 *
 * Lifecycle, editabilidade, profundidade da árvore causal e vencimento de ações
 * corretivas são decididos aqui, longe de Nest e do banco, para que servidor e
 * testes compartilhem exatamente a mesma regra.
 */

export type PostmortemStatus =
  | "DRAFT"
  | "IN_REVIEW"
  | "CHANGES_REQUESTED"
  | "APPROVED"
  | "PUBLISHED"
  | "ARCHIVED";

export type PostmortemCauseType =
  | "ROOT_CAUSE"
  | "CONTRIBUTING_FACTOR"
  | "CONDITION";

export type PostmortemCauseCategory =
  | "PEOPLE"
  | "PROCESS"
  | "TECHNOLOGY"
  | "COMMUNICATION"
  | "LOGISTICS"
  | "EXTERNAL"
  | "OTHER";

export type PostmortemLessonType =
  | "WENT_WELL"
  | "WENT_WRONG"
  | "LESSON"
  | "FOLLOW_UP";

export type PostmortemActionStatus =
  | "OPEN"
  | "IN_PROGRESS"
  | "DONE"
  | "CANCELLED";

export type PostmortemReviewDecision = "APPROVED" | "CHANGES_REQUESTED";

export type PostmortemTimelineSource =
  | "INCIDENT_EVENT"
  | "SHIFT_HANDOVER"
  | "TASK"
  | "RESOURCE_REQUEST"
  | "MANUAL";

export type PostmortemAction =
  | "edit"
  | "submitForReview"
  | "review"
  | "publish"
  | "archive"
  | "importTimeline";

export const POSTMORTEM_STATUSES: readonly PostmortemStatus[] = [
  "DRAFT",
  "IN_REVIEW",
  "CHANGES_REQUESTED",
  "APPROVED",
  "PUBLISHED",
  "ARCHIVED",
];

/** Tabela normativa de transições (SPEC parte 3.3). */
export const POSTMORTEM_TRANSITIONS: Record<
  PostmortemStatus,
  readonly PostmortemStatus[]
> = {
  DRAFT: ["IN_REVIEW", "ARCHIVED"],
  IN_REVIEW: ["APPROVED", "CHANGES_REQUESTED", "ARCHIVED"],
  CHANGES_REQUESTED: ["IN_REVIEW", "ARCHIVED"],
  APPROVED: ["PUBLISHED", "ARCHIVED"],
  PUBLISHED: ["ARCHIVED"],
  ARCHIVED: [],
};

/** Status em que o conteúdo analítico pode ser editado. */
export const POSTMORTEM_EDITABLE_STATUSES: readonly PostmortemStatus[] = [
  "DRAFT",
  "CHANGES_REQUESTED",
];

/** Status em que o postmortem conta como ativo para a cardinalidade do incidente. */
export const POSTMORTEM_ACTIVE_STATUSES: readonly PostmortemStatus[] =
  POSTMORTEM_STATUSES.filter((status) => status !== "ARCHIVED");

export function canTransitionPostmortem(
  from: PostmortemStatus,
  to: PostmortemStatus,
): boolean {
  return POSTMORTEM_TRANSITIONS[from].includes(to);
}

export function isPostmortemEditable(status: PostmortemStatus): boolean {
  return POSTMORTEM_EDITABLE_STATUSES.includes(status);
}

export function isPostmortemActive(status: PostmortemStatus): boolean {
  return POSTMORTEM_ACTIVE_STATUSES.includes(status);
}

/** Profundidade máxima da árvore causal e da ferramenta 5 Whys. */
export const POSTMORTEM_MAX_CAUSE_DEPTH = 5;

/** Severidades de incidente que exigem ação corretiva antes do review. */
export const POSTMORTEM_ACTION_REQUIRED_SEVERITIES: readonly string[] = [
  "HIGH",
  "CRITICAL",
];

/** Status de incidente aceitos para abrir um postmortem para review. */
export const POSTMORTEM_INCIDENT_ELIGIBLE_STATUSES: readonly string[] = [
  "RESOLVED",
  "CLOSED",
];

export function requiresCorrectiveAction(severity: string): boolean {
  return POSTMORTEM_ACTION_REQUIRED_SEVERITIES.includes(severity);
}

export interface PostmortemCauseNode {
  id: string;
  parentId?: string | null;
}

export function causeDepth(
  causeId: string,
  causes: readonly PostmortemCauseNode[],
): number {
  const byId = new Map(causes.map((cause) => [cause.id, cause]));
  let depth = 1;
  let current = byId.get(causeId)?.parentId ?? null;
  const visited = new Set<string>([causeId]);
  while (current) {
    if (visited.has(current)) return Number.POSITIVE_INFINITY;
    visited.add(current);
    depth += 1;
    current = byId.get(current)?.parentId ?? null;
  }
  return depth;
}

/**
 * Valida a inserção de uma causa na árvore. Devolve `null` quando a posição é
 * válida, ou o motivo objetivo da rejeição.
 */
export function validateCausePlacement(
  parentId: string | null | undefined,
  causes: readonly PostmortemCauseNode[],
): string | null {
  if (!parentId) return null;
  const parent = causes.find((cause) => cause.id === parentId);
  if (!parent) return "Causa superior não pertence a este postmortem.";
  const depth = causeDepth(parentId, causes);
  if (depth >= POSTMORTEM_MAX_CAUSE_DEPTH)
    return `Profundidade máxima de ${POSTMORTEM_MAX_CAUSE_DEPTH} níveis atingida.`;
  return null;
}

export interface PostmortemActionItemState {
  status: PostmortemActionStatus;
  dueAt?: Date | string | null;
}

export function isPostmortemActionOverdue(
  action: PostmortemActionItemState,
  now: Date = new Date(),
): boolean {
  if (action.status !== "OPEN" && action.status !== "IN_PROGRESS") return false;
  if (!action.dueAt) return false;
  const dueAt = action.dueAt instanceof Date ? action.dueAt : new Date(action.dueAt);
  if (Number.isNaN(dueAt.getTime())) return false;
  return dueAt.getTime() < now.getTime();
}

export interface PostmortemReviewEntry {
  reviewerId: string;
  decision: PostmortemReviewDecision;
  createdAt: Date | string;
}

/**
 * Regra de aprovação: todos os reviewers designados precisam de decisão
 * `APPROVED` na sua decisão **mais recente**. Reviews anteriores são preservados
 * no histórico, mas não decidem o resultado.
 */
export function latestDecisions(
  reviews: readonly PostmortemReviewEntry[],
): Map<string, PostmortemReviewDecision> {
  const latest = new Map<string, { decision: PostmortemReviewDecision; at: number }>();
  for (const review of reviews) {
    const at =
      review.createdAt instanceof Date
        ? review.createdAt.getTime()
        : new Date(review.createdAt).getTime();
    const current = latest.get(review.reviewerId);
    if (!current || at >= current.at) {
      latest.set(review.reviewerId, { decision: review.decision, at });
    }
  }
  return new Map([...latest].map(([id, value]) => [id, value.decision]));
}

/**
 * Acrescenta uma decisão à timeline de reviews sem remover as anteriores. O
 * histórico é sempre append-only; o resultado é o novo estado do histórico.
 */
export function applyPostmortemReviews(
  _reviewerIds: readonly string[],
  existing: readonly PostmortemReviewEntry[],
  decision: PostmortemReviewEntry,
): PostmortemReviewEntry[] {
  return [...existing, decision];
}

export interface ApprovalEvaluation {
  approved: boolean;
  pendingReviewerIds: string[];
  changesRequestedBy: string[];
}

export function evaluatePostmortemApproval(
  reviewerIds: readonly string[],
  reviews: readonly PostmortemReviewEntry[],
): ApprovalEvaluation {
  const decisions = latestDecisions(reviews);
  const pendingReviewerIds: string[] = [];
  const changesRequestedBy: string[] = [];
  for (const reviewerId of reviewerIds) {
    const decision = decisions.get(reviewerId);
    if (decision === undefined) pendingReviewerIds.push(reviewerId);
    else if (decision === "CHANGES_REQUESTED") changesRequestedBy.push(reviewerId);
  }
  return {
    approved:
      reviewerIds.length > 0 &&
      pendingReviewerIds.length === 0 &&
      changesRequestedBy.length === 0,
    pendingReviewerIds,
    changesRequestedBy,
  };
}

export interface PostmortemSubmitPreconditionInput {
  incidentStatus?: string | null;
  severity?: string | null;
  executiveSummary?: string | null;
  impactSummary?: string | null;
  rootCauseSummary?: string | null;
  rootCauseCount: number;
  lessonCount: number;
  actionCount: number;
  reviewerCount: number;
}

/**
 * Pré-condições de submissão para review (SPEC parte 3.14). Devolve a lista de
 * impedimentos; lista vazia significa que o postmortem está apto.
 */
export function postmortemSubmitBlockers(
  input: PostmortemSubmitPreconditionInput,
): string[] {
  const blockers: string[] = [];
  const filled = (value?: string | null) => Boolean(value && value.trim().length);
  if (!input.incidentStatus)
    blockers.push("Incidente primário não encontrado.");
  else if (!POSTMORTEM_INCIDENT_ELIGIBLE_STATUSES.includes(input.incidentStatus))
    blockers.push("O incidente primário precisa estar resolvido ou encerrado.");
  if (!filled(input.executiveSummary))
    blockers.push("Informe o resumo executivo.");
  if (!filled(input.impactSummary)) blockers.push("Informe o impacto.");
  if (!filled(input.rootCauseSummary))
    blockers.push("Informe o resumo da causa raiz.");
  if (input.rootCauseCount < 1)
    blockers.push("Registre ao menos uma causa raiz estruturada.");
  if (input.lessonCount < 1)
    blockers.push("Registre ao menos uma lição aprendida.");
  if (input.reviewerCount < 1)
    blockers.push("Designe ao menos um revisor.");
  if (requiresCorrectiveAction(input.severity ?? "") && input.actionCount < 1)
    blockers.push(
      "Incidentes HIGH/CRITICAL exigem ao menos uma ação corretiva.",
    );
  return blockers;
}

export function availablePostmortemActions(input: {
  status: PostmortemStatus;
  createdById: string;
  ownerId?: string | null;
  actorId: string;
  permissions: readonly string[];
  isReviewer: boolean;
}): PostmortemAction[] {
  const actions: PostmortemAction[] = [];
  const manages = input.permissions.includes("postmortems.manage");
  const reviews = input.permissions.includes("postmortems.review");
  const publishes = input.permissions.includes("postmortems.publish");
  const owns =
    input.actorId === input.createdById ||
    (Boolean(input.ownerId) && input.actorId === input.ownerId);

  if (isPostmortemEditable(input.status) && owns && manages) {
    actions.push("edit", "submitForReview", "importTimeline");
  }
  if (input.status === "IN_REVIEW" && input.isReviewer && reviews) {
    actions.push("review");
  }
  if (input.status === "APPROVED" && publishes) actions.push("publish");
  if (input.status !== "ARCHIVED" && manages) actions.push("archive");
  return actions;
}

export function postmortemCode(year: number, sequence: number): string {
  return `PM-${year}-${String(sequence).padStart(4, "0")}`;
}

/** Chave de origem usada para tornar o import de timeline idempotente. */
export function timelineSourceKey(sourceId: string | null | undefined): string | null {
  return sourceId && sourceId.trim() ? sourceId.trim() : null;
}

export const POSTMORTEM_STATUS_LABELS: Record<PostmortemStatus, string> = {
  DRAFT: "Rascunho",
  IN_REVIEW: "Em revisão",
  CHANGES_REQUESTED: "Mudanças solicitadas",
  APPROVED: "Aprovado",
  PUBLISHED: "Publicado",
  ARCHIVED: "Arquivado",
};

export const POSTMORTEM_CAUSE_TYPE_LABELS: Record<PostmortemCauseType, string> = {
  ROOT_CAUSE: "Causa raiz",
  CONTRIBUTING_FACTOR: "Fator contribuinte",
  CONDITION: "Condição",
};

export const POSTMORTEM_CAUSE_CATEGORY_LABELS: Record<
  PostmortemCauseCategory,
  string
> = {
  PEOPLE: "Pessoas",
  PROCESS: "Processo",
  TECHNOLOGY: "Tecnologia",
  COMMUNICATION: "Comunicação",
  LOGISTICS: "Logística",
  EXTERNAL: "Externo",
  OTHER: "Outro",
};

export const POSTMORTEM_LESSON_TYPE_LABELS: Record<
  PostmortemLessonType,
  string
> = {
  WENT_WELL: "O que funcionou",
  WENT_WRONG: "O que falhou",
  LESSON: "Lição",
  FOLLOW_UP: "Acompanhamento",
};

export const POSTMORTEM_ACTION_STATUS_LABELS: Record<
  PostmortemActionStatus,
  string
> = {
  OPEN: "Aberta",
  IN_PROGRESS: "Em andamento",
  DONE: "Concluída",
  CANCELLED: "Cancelada",
};

export const POSTMORTEM_TIMELINE_SOURCE_LABELS: Record<
  PostmortemTimelineSource,
  string
> = {
  INCIDENT_EVENT: "Evento do incidente",
  SHIFT_HANDOVER: "Passagem de turno",
  TASK: "Tarefa",
  RESOURCE_REQUEST: "Solicitação de recurso",
  MANUAL: "Manual",
};

export const RECURRING_CAUSE_MIN_OCCURRENCES = 2;
