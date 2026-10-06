/**
 * Contratos e regras puras do domínio de pedido operacional de recurso.
 *
 * Lifecycle, urgência, cálculo de fulfillment e derivação de ações são funções
 * puras: o servidor aplica, o cliente exibe, os testes verificam a mesma regra.
 */

export type ResourceRequestStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "TRIAGED"
  | "APPROVED"
  | "PARTIALLY_FULFILLED"
  | "FULFILLED"
  | "REJECTED"
  | "CANCELLED";

export type ResourceRequestPriority = "LOW" | "NORMAL" | "HIGH" | "CRITICAL";

export type ResourceRequestItemKind =
  | "ASSET"
  | "ASSET_TYPE"
  | "FIELD_TEAM"
  | "VEHICLE"
  | "TRANSPORT"
  | "TECH_SUPPORT"
  | "MATERIAL"
  | "OTHER";

export type ResourceRequestUrgency =
  | "ON_TRACK"
  | "DUE_SOON"
  | "OVERDUE"
  | "COMPLETED";

export type ResourceRequestAction =
  | "edit"
  | "submit"
  | "triage"
  | "approve"
  | "reject"
  | "addFulfillment"
  | "removeFulfillment"
  | "cancel"
  | "addComment";

export const RESOURCE_REQUEST_STATUSES: readonly ResourceRequestStatus[] = [
  "DRAFT",
  "SUBMITTED",
  "TRIAGED",
  "APPROVED",
  "PARTIALLY_FULFILLED",
  "FULFILLED",
  "REJECTED",
  "CANCELLED",
];

export const RESOURCE_REQUEST_PRIORITIES: readonly ResourceRequestPriority[] = [
  "LOW",
  "NORMAL",
  "HIGH",
  "CRITICAL",
];

export const RESOURCE_REQUEST_ITEM_KINDS: readonly ResourceRequestItemKind[] = [
  "ASSET",
  "ASSET_TYPE",
  "FIELD_TEAM",
  "VEHICLE",
  "TRANSPORT",
  "TECH_SUPPORT",
  "MATERIAL",
  "OTHER",
];

/** Status terminais: nenhuma transição parte deles. */
export const RESOURCE_REQUEST_TERMINAL_STATUSES: readonly ResourceRequestStatus[] =
  ["FULFILLED", "REJECTED", "CANCELLED"];

/** Status em que o pedido ainda consome atenção operacional. */
export const RESOURCE_REQUEST_OPEN_STATUSES: readonly ResourceRequestStatus[] = [
  "SUBMITTED",
  "TRIAGED",
  "APPROVED",
  "PARTIALLY_FULFILLED",
];

/** Status em que o conteúdo do pedido pode ser editado. */
export const RESOURCE_REQUEST_EDITABLE_STATUSES: readonly ResourceRequestStatus[] =
  ["DRAFT"];

/** Tabela normativa de transições (SPEC parte 2.3). */
export const RESOURCE_REQUEST_TRANSITIONS: Record<
  ResourceRequestStatus,
  readonly ResourceRequestStatus[]
> = {
  DRAFT: ["SUBMITTED", "CANCELLED"],
  SUBMITTED: ["TRIAGED", "REJECTED", "CANCELLED"],
  TRIAGED: ["APPROVED", "REJECTED", "CANCELLED"],
  APPROVED: ["PARTIALLY_FULFILLED", "FULFILLED", "CANCELLED"],
  PARTIALLY_FULFILLED: ["FULFILLED", "CANCELLED"],
  FULFILLED: [],
  REJECTED: [],
  CANCELLED: [],
};

export function canTransitionResourceRequest(
  from: ResourceRequestStatus,
  to: ResourceRequestStatus,
): boolean {
  return RESOURCE_REQUEST_TRANSITIONS[from].includes(to);
}

export function isTerminalResourceRequestStatus(
  status: ResourceRequestStatus,
): boolean {
  return RESOURCE_REQUEST_TERMINAL_STATUSES.includes(status);
}

export function isOpenResourceRequestStatus(
  status: ResourceRequestStatus,
): boolean {
  return RESOURCE_REQUEST_OPEN_STATUSES.includes(status);
}

/** Janela objetiva de urgência, em horas. */
export const RESOURCE_REQUEST_DUE_SOON_HOURS = 4;

export interface UrgencyInput {
  status: ResourceRequestStatus;
  neededAt?: Date | string | null;
  now?: Date;
}

export function deriveUrgency(input: UrgencyInput): ResourceRequestUrgency {
  if (isTerminalResourceRequestStatus(input.status)) return "COMPLETED";
  if (!input.neededAt) return "ON_TRACK";
  const now = input.now ?? new Date();
  const neededAt =
    input.neededAt instanceof Date ? input.neededAt : new Date(input.neededAt);
  if (Number.isNaN(neededAt.getTime())) return "ON_TRACK";
  const remainingMs = neededAt.getTime() - now.getTime();
  if (remainingMs < 0) return "OVERDUE";
  if (remainingMs <= RESOURCE_REQUEST_DUE_SOON_HOURS * 3_600_000)
    return "DUE_SOON";
  return "ON_TRACK";
}

const URGENCY_ORDER: Record<ResourceRequestUrgency, number> = {
  OVERDUE: 0,
  DUE_SOON: 1,
  ON_TRACK: 2,
  COMPLETED: 3,
};

const PRIORITY_ORDER: Record<ResourceRequestPriority, number> = {
  CRITICAL: 0,
  HIGH: 1,
  NORMAL: 2,
  LOW: 3,
};

export function compareUrgency(
  left: ResourceRequestUrgency,
  right: ResourceRequestUrgency,
): number {
  return URGENCY_ORDER[left] - URGENCY_ORDER[right];
}

export interface FulfillmentItemState {
  quantity: number;
  fulfilledQuantity: number;
}

export interface FulfillmentTotals {
  totalRequired: number;
  totalFulfilled: number;
  totalRemaining: number;
  totalItems: number;
  satisfiedItems: number;
  fullySatisfied: boolean;
  anyFulfilled: boolean;
}

export function summarizeFulfillment(
  items: readonly FulfillmentItemState[],
): FulfillmentTotals {
  let totalRequired = 0;
  let totalFulfilled = 0;
  let satisfiedItems = 0;
  for (const item of items) {
    const required = Math.max(0, Math.trunc(item.quantity));
    const fulfilled = Math.max(0, Math.trunc(item.fulfilledQuantity));
    totalRequired += required;
    totalFulfilled += fulfilled;
    if (fulfilled >= required) satisfiedItems += 1;
  }
  return {
    totalRequired,
    totalFulfilled,
    totalRemaining: Math.max(0, totalRequired - totalFulfilled),
    totalItems: items.length,
    satisfiedItems,
    fullySatisfied: items.length > 0 && satisfiedItems === items.length,
    anyFulfilled: totalFulfilled > 0,
  };
}

/**
 * Status derivado do fulfillment. `null` significa "manter o status atual":
 * o cálculo nunca rebaixa um pedido por ausência de atendimento.
 */
export function deriveFulfillmentStatus(
  items: readonly FulfillmentItemState[],
): Extract<
  ResourceRequestStatus,
  "FULFILLED" | "PARTIALLY_FULFILLED"
> | null {
  const totals = summarizeFulfillment(items);
  if (totals.totalItems === 0) return null;
  if (totals.fullySatisfied) return "FULFILLED";
  if (totals.anyFulfilled) return "PARTIALLY_FULFILLED";
  return null;
}

export function fulfillmentProgressPercent(totals: FulfillmentTotals): number {
  if (totals.totalRequired === 0) return 0;
  return Math.min(100, Math.round((totals.totalFulfilled / totals.totalRequired) * 100));
}

export interface ResourceRequestQueueEntry {
  urgency: ResourceRequestUrgency;
  priority: ResourceRequestPriority;
  neededAt?: string | null;
  createdAt: string;
}

/** Ordenação normativa da fila operacional (SPEC parte 2.14). */
export function compareResourceRequestQueue(
  left: ResourceRequestQueueEntry,
  right: ResourceRequestQueueEntry,
): number {
  const urgency = compareUrgency(left.urgency, right.urgency);
  if (urgency !== 0) return urgency;
  const priority =
    PRIORITY_ORDER[left.priority] - PRIORITY_ORDER[right.priority];
  if (priority !== 0) return priority;
  const leftNeeded = left.neededAt ? new Date(left.neededAt).getTime() : null;
  const rightNeeded = right.neededAt ? new Date(right.neededAt).getTime() : null;
  if (leftNeeded !== null || rightNeeded !== null) {
    if (leftNeeded === null) return 1;
    if (rightNeeded === null) return -1;
    if (leftNeeded !== rightNeeded) return leftNeeded - rightNeeded;
  }
  return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
}

export interface AvailableResourceRequestActionsInput {
  status: ResourceRequestStatus;
  requestedById: string;
  ownerId?: string | null;
  actorId: string;
  permissions: readonly string[];
}

/**
 * Ações derivadas no servidor. O cliente apenas exibe o que recebe; nunca
 * recalcula autorização.
 */
export function availableResourceRequestActions(
  input: AvailableResourceRequestActionsInput,
): ResourceRequestAction[] {
  const actions: ResourceRequestAction[] = [];
  const manages = input.permissions.includes("resource-requests.manage");
  const approves = input.permissions.includes("resource-requests.approve");
  const fulfills = input.permissions.includes("resource-requests.fulfill");
  const isRequester = input.actorId === input.requestedById;
  const isOwner = Boolean(input.ownerId) && input.actorId === input.ownerId;
  const owns = isRequester || isOwner;

  if (input.status === "DRAFT" && (isRequester || manages)) actions.push("edit");
  if (input.status === "DRAFT" && isRequester) actions.push("submit");
  if (input.status === "SUBMITTED" && manages) actions.push("triage");
  if ((input.status === "SUBMITTED" || input.status === "TRIAGED") && approves) {
    actions.push("approve", "reject");
  }
  if (
    (input.status === "TRIAGED" ||
      input.status === "APPROVED" ||
      input.status === "PARTIALLY_FULFILLED") &&
    fulfills
  ) {
    actions.push("addFulfillment");
  }
  if (
    (input.status === "APPROVED" ||
      input.status === "PARTIALLY_FULFILLED" ||
      input.status === "FULFILLED") &&
    fulfills
  ) {
    actions.push("removeFulfillment");
  }
  if (
    !isTerminalResourceRequestStatus(input.status) &&
    (manages || owns)
  ) {
    actions.push("cancel");
  }
  if (!isTerminalResourceRequestStatus(input.status) || manages) {
    actions.push("addComment");
  }
  return actions;
}

/** Chave de sequência anual usada na geração de `code`. */
export function resourceRequestCode(year: number, sequence: number): string {
  return `RR-${year}-${String(sequence).padStart(4, "0")}`;
}

export const RESOURCE_REQUEST_STATUS_LABELS: Record<
  ResourceRequestStatus,
  string
> = {
  DRAFT: "Rascunho",
  SUBMITTED: "Submetido",
  TRIAGED: "Triado",
  APPROVED: "Aprovado",
  PARTIALLY_FULFILLED: "Parcialmente atendido",
  FULFILLED: "Atendido",
  REJECTED: "Rejeitado",
  CANCELLED: "Cancelado",
};

export const RESOURCE_REQUEST_PRIORITY_LABELS: Record<
  ResourceRequestPriority,
  string
> = {
  LOW: "Baixa",
  NORMAL: "Normal",
  HIGH: "Alta",
  CRITICAL: "Crítica",
};

export const RESOURCE_REQUEST_ITEM_KIND_LABELS: Record<
  ResourceRequestItemKind,
  string
> = {
  ASSET: "Ativo específico",
  ASSET_TYPE: "Tipo de ativo",
  FIELD_TEAM: "Equipe de campo",
  VEHICLE: "Veículo",
  TRANSPORT: "Transporte",
  TECH_SUPPORT: "Apoio técnico",
  MATERIAL: "Material",
  OTHER: "Outro recurso",
};

export const RESOURCE_REQUEST_URGENCY_LABELS: Record<
  ResourceRequestUrgency,
  string
> = {
  ON_TRACK: "No prazo",
  DUE_SOON: "Prazo próximo",
  OVERDUE: "Vencido",
  COMPLETED: "Concluído",
};

/** Itens que exigem uma referência de catálogo para manter integridade. */
export function requiresAssetType(kind: ResourceRequestItemKind): boolean {
  return kind === "ASSET_TYPE";
}

export function requiresFieldTeam(kind: ResourceRequestItemKind): boolean {
  return kind === "FIELD_TEAM";
}

export function requiresVehicle(kind: ResourceRequestItemKind): boolean {
  return kind === "VEHICLE";
}
