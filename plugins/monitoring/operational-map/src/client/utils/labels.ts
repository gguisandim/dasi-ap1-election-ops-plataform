import type { OperationalMapFeatureType } from "../../shared/types/operational-map";

/** Glifo textual por tipo — a semântica nunca depende apenas de cor. */
export const TYPE_GLYPHS: Record<OperationalMapFeatureType, string> = {
  POLLING_PLACE: "◉",
  INCIDENT: "!",
  TRANSMISSION: "⇅",
  FIELD_TEAM: "◆",
  ROUTE: "➜",
  ASSET: "▣",
};

const LAYER_STATUSES: Record<OperationalMapFeatureType, string[]> = {
  POLLING_PLACE: ["NORMAL", "ATTENTION", "CRITICAL", "OFFLINE"],
  INCIDENT: ["NEW", "TRIAGED", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "CLOSED", "CANCELLED"],
  TRANSMISSION: ["WAITING", "QUEUED", "TRANSMITTING", "SUCCESS", "FAILED", "RETRYING", "OFFLINE"],
  ASSET: ["AVAILABLE", "ALLOCATED", "IN_TRANSIT", "IN_USE", "MAINTENANCE", "LOST", "RETIRED"],
  FIELD_TEAM: ["ACTIVE", "STANDBY", "INACTIVE"],
  ROUTE: ["PLANNED", "READY", "IN_PROGRESS", "DELAYED", "COMPLETED", "CANCELLED"],
};

export const STATUS_LABELS: Record<string, string> = {
  NORMAL: "Normal", ATTENTION: "Atenção", CRITICAL: "Crítico", OFFLINE: "Offline",
  NEW: "Novo", TRIAGED: "Triado", ASSIGNED: "Atribuído", IN_PROGRESS: "Em atendimento", RESOLVED: "Resolvido", CLOSED: "Fechado", CANCELLED: "Cancelado",
  WAITING: "Aguardando", QUEUED: "Na fila", TRANSMITTING: "Transmitindo", SUCCESS: "Sucesso", FAILED: "Falhou", RETRYING: "Repetindo",
  AVAILABLE: "Disponível", ALLOCATED: "Alocado", IN_TRANSIT: "Em trânsito", IN_USE: "Em uso", MAINTENANCE: "Manutenção", LOST: "Extraviado", RETIRED: "Baixado",
  ACTIVE: "Ativo", STANDBY: "Standby", INACTIVE: "Inativo",
  PLANNED: "Planejado", READY: "Pronto", DELAYED: "Atrasado", COMPLETED: "Concluído",
};

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

export function statusTone(status: string): "neutral" | "success" | "warning" | "danger" {
  if (["CRITICAL", "FAILED", "OFFLINE", "LOST", "DELAYED"].includes(status)) return "danger";
  if (["ATTENTION", "MAINTENANCE", "DAMAGED", "RETRYING", "STANDBY", "READY"].includes(status)) return "warning";
  if (["SUCCESS", "RESOLVED", "CLOSED", "COMPLETED", "ACTIVE", "AVAILABLE", "NORMAL", "IN_USE"].includes(status)) return "success";
  return "neutral";
}

/** Valores de status relevantes para as camadas selecionadas, sem duplicatas. */
export function statusOptionsFor(layers: OperationalMapFeatureType[]): string[] {
  const seen = new Set<string>();
  for (const layer of layers) for (const status of LAYER_STATUSES[layer]) seen.add(status);
  return [...seen];
}
