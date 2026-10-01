import type { ChecklistItemStatus, ChecklistStatus } from "../types";

export const CHECKLIST_STATUS_LABELS: Record<ChecklistStatus, string> = {
  PENDING: "Pendente", IN_PROGRESS: "Em andamento", READY_FOR_APPROVAL: "Pronto para aprovação", APPROVED: "Aprovado", BLOCKED: "Bloqueado",
};
export const CHECKLIST_ITEM_STATUS_LABELS: Record<ChecklistItemStatus, string> = {
  PENDING: "Pendente", IN_PROGRESS: "Em andamento", COMPLETED: "Concluído", BLOCKED: "Bloqueado",
};
export const CHECKLIST_HISTORY_LABELS: Record<string, string> = {
  CREATED: "Checklist criado", ASSIGNEE_CHANGED: "Responsável alterado", ITEM_UPDATED: "Item atualizado", EVIDENCE_ADDED: "Evidência registrada", BLOCKED: "Checklist bloqueado", ITEM_COMPLETED: "Item concluído", APPROVED: "Local aprovado", APPROVAL_REVOKED: "Aprovação revogada",
};