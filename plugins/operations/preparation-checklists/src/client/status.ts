import type { ChecklistItemStatus, ChecklistStatus, CriticalBlockerReason, DeadlineState } from "../types";

export const DEADLINE_STATE_LABELS: Record<DeadlineState, string> = {
  ON_TRACK: "No prazo", AT_RISK: "Prazo próximo", OVERDUE: "Atrasado",
};
export const CRITICAL_BLOCKER_LABELS: Record<CriticalBlockerReason, string> = {
  REQUIRED_PENDING: "Item obrigatório pendente", MISSING_EVIDENCE: "Evidência obrigatória ausente", BLOCKED: "Item bloqueado",
};
export const CHECKLIST_STATUS_LABELS: Record<ChecklistStatus, string> = {
  PENDING: "Pendente", IN_PROGRESS: "Em andamento", READY_FOR_APPROVAL: "Pronto para aprovação", APPROVED: "Aprovado", BLOCKED: "Bloqueado",
};
export const CHECKLIST_ITEM_STATUS_LABELS: Record<ChecklistItemStatus, string> = {
  PENDING: "Pendente", IN_PROGRESS: "Em andamento", COMPLETED: "Concluído", BLOCKED: "Bloqueado",
};
export const CHECKLIST_HISTORY_LABELS: Record<string, string> = {
  CREATED: "Checklist criado", ASSIGNEE_CHANGED: "Responsável alterado", ITEM_UPDATED: "Item atualizado", EVIDENCE_ADDED: "Evidência registrada", BLOCKED: "Checklist bloqueado", ITEM_COMPLETED: "Item concluído", APPROVED: "Local aprovado", APPROVAL_REVOKED: "Aprovação revogada",
};