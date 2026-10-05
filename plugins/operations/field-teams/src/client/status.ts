import {
  dispatchOperationalState,
  FIELD_DISPATCH_TERMINAL_STATUSES,
  type FieldDispatchPriority,
  type FieldDispatchStatus,
  type FieldOperationalState,
} from "@eops/shared/workforce";

export {
  dispatchOperationalState,
  FIELD_DISPATCH_TERMINAL_STATUSES,
};

export type { FieldOperationalState };

export const DISPATCH_STATUS_LABELS: Record<FieldDispatchStatus, string> = {
  REQUESTED: "Solicitado",
  DISPATCHED: "Despachado",
  ACCEPTED: "Aceito",
  EN_ROUTE: "Em deslocamento",
  ARRIVED: "No local",
  IN_PROGRESS: "Em atendimento",
  COMPLETED: "Concluído",
  REJECTED: "Rejeitado",
  CANCELLED: "Cancelado",
};

export const DISPATCH_PRIORITY_LABELS: Record<FieldDispatchPriority, string> = {
  LOW: "Baixa",
  MEDIUM: "Média",
  HIGH: "Alta",
  CRITICAL: "Crítica",
};

export const DISPATCH_PRIORITIES: FieldDispatchPriority[] = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL",
];

export const OPERATIONAL_STATE_LABELS: Record<FieldOperationalState, string> = {
  AVAILABLE: "Disponível",
  DISPATCHED: "Despachada",
  EN_ROUTE: "Em deslocamento",
  ON_SITE: "No local",
  IN_PROGRESS: "Em atendimento",
};

export function formatDuration(minutes: number | null | undefined) {
  if (minutes === null || minutes === undefined) return "—";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${String(minutes % 60).padStart(2, "0")}min`;
}
