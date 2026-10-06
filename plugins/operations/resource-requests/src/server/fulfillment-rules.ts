import {
  RESOURCE_REQUEST_ITEM_KINDS,
  requiresAssetType,
  requiresFieldTeam,
  requiresVehicle,
  type ResourceRequestItemKind,
} from "@eops/shared/resource-requests";

/**
 * Regras puras de elegibilidade e integridade do atendimento.
 *
 * O plugin lê outros domínios (Asset, AssetReservation, FieldTeam, Vehicle,
 * DistributionRoute, Task) mas nunca altera o lifecycle deles. Estas funções
 * recebem as linhas já carregadas e devolvem, ou `null` quando o vínculo é
 * válido, ou o motivo objetivo da rejeição.
 */

export const ASSET_FULFILLMENT_ALLOWED_STATUSES: readonly string[] = [
  "AVAILABLE",
  "ALLOCATED",
  "IN_USE",
  "IN_TRANSIT",
];

export const ASSET_FULFILLMENT_BLOCKED_STATUSES: readonly string[] = [
  "LOST",
  "RETIRED",
  "MAINTENANCE",
];

export const RESERVATION_FULFILLABLE_STATUSES: readonly string[] = [
  "REQUESTED",
  "APPROVED",
];

export interface AssetEligibilityInput {
  status: string;
  condition?: string | null;
}

export function validateAssetEligibility(
  asset: AssetEligibilityInput | null | undefined,
): string | null {
  if (!asset) return "Ativo não encontrado.";
  if (ASSET_FULFILLMENT_BLOCKED_STATUSES.includes(asset.status))
    return `Ativo com status ${asset.status} não pode atender uma solicitação.`;
  if (!ASSET_FULFILLMENT_ALLOWED_STATUSES.includes(asset.status))
    return `Ativo com status ${asset.status} não está disponível para atendimento.`;
  if (asset.condition === "UNAVAILABLE")
    return "Ativo marcado como indisponível para a operação.";
  return null;
}

export function validateReservationBinding(
  reservation: { assetId: string; status: string } | null | undefined,
  assetId: string | null | undefined,
): string | null {
  if (!reservation) return "Reserva não encontrada.";
  if (assetId && reservation.assetId !== assetId)
    return "A reserva informada não pertence ao ativo selecionado.";
  if (!RESERVATION_FULFILLABLE_STATUSES.includes(reservation.status))
    return `Reserva com status ${reservation.status} não pode ser usada no atendimento.`;
  return null;
}

export function validateTeamEligibility(
  team: { status: string; electionId: string } | null | undefined,
  requestElectionId: string,
): string | null {
  if (!team) return "Equipe de campo não encontrada.";
  if (team.status !== "ACTIVE")
    return "Somente equipes ativas podem atender uma solicitação.";
  if (team.electionId !== requestElectionId)
    return "Equipe de campo pertence a outro pleito.";
  return null;
}

export function validateVehicleEligibility(
  vehicle: { status: string } | null | undefined,
): string | null {
  if (!vehicle) return "Veículo não encontrado.";
  if (vehicle.status === "UNAVAILABLE")
    return "Veículo indisponível para uso operacional.";
  return null;
}

export function validateRouteEligibility(
  route: { electionId: string } | null | undefined,
  requestElectionId: string,
): string | null {
  if (!route) return "Rota não encontrada.";
  if (route.electionId !== requestElectionId)
    return "Rota pertence a outro pleito.";
  return null;
}

export interface ItemReferenceInput {
  kind: ResourceRequestItemKind;
  assetTypeId?: string | null;
  fieldTeamId?: string | null;
  vehicleId?: string | null;
}

/**
 * Garante que cada item traz exatamente as referências de catálogo que o seu
 * tipo exige — e nenhuma referência impossível para conceitos genéricos.
 */
export function validateItemReferences(item: ItemReferenceInput): string | null {
  if (!RESOURCE_REQUEST_ITEM_KINDS.includes(item.kind))
    return `Tipo de item inválido: ${item.kind}.`;
  if (requiresAssetType(item.kind) && !item.assetTypeId)
    return "Informe o tipo de ativo para itens do tipo ASSET_TYPE.";
  if (!requiresAssetType(item.kind) && item.assetTypeId)
    return `O tipo de item ${item.kind} não aceita tipo de ativo.`;
  if (requiresFieldTeam(item.kind) && !item.fieldTeamId)
    return "Informe a equipe de campo para itens do tipo FIELD_TEAM.";
  if (!requiresFieldTeam(item.kind) && item.fieldTeamId)
    return `O tipo de item ${item.kind} não aceita equipe de campo.`;
  if (requiresVehicle(item.kind) && !item.vehicleId)
    return "Informe o veículo para itens do tipo VEHICLE.";
  if (!requiresVehicle(item.kind) && item.vehicleId)
    return `O tipo de item ${item.kind} não aceita veículo.`;
  return null;
}

export function validateItemQuantity(quantity: number): string | null {
  if (!Number.isInteger(quantity) || quantity < 1)
    return "A quantidade deve ser um inteiro maior ou igual a 1.";
  return null;
}

export interface FulfillmentQuantityInput {
  quantity: number;
  remainingQuantity: number;
}

export function validateFulfillmentQuantity(
  input: FulfillmentQuantityInput,
): string | null {
  if (!Number.isInteger(input.quantity) || input.quantity < 1)
    return "Informe uma quantidade maior ou igual a 1.";
  if (input.quantity > input.remainingQuantity)
    return `A quantidade informada excede o saldo pendente (${input.remainingQuantity}).`;
  return null;
}

export interface FulfillmentLinkInput {
  assetId?: string | null;
  assetReservationId?: string | null;
  fieldTeamId?: string | null;
  vehicleId?: string | null;
  routeId?: string | null;
  taskId?: string | null;
}

/**
 * Um fulfillment precisa referenciar ao menos um vínculo operacional quando o
 * item exige comprovação, mas nunca pode referenciar dados inexistentes.
 */
export function requiresOperationalLink(
  kind: ResourceRequestItemKind,
): boolean {
  return (
    kind === "ASSET" ||
    kind === "ASSET_TYPE" ||
    kind === "FIELD_TEAM" ||
    kind === "VEHICLE" ||
    kind === "TRANSPORT"
  );
}

export function missingOperationalLink(
  kind: ResourceRequestItemKind,
  link: FulfillmentLinkInput,
): string | null {
  if (!requiresOperationalLink(kind)) return null;
  const hasLink = Boolean(
    link.assetId ||
      link.assetReservationId ||
      link.fieldTeamId ||
      link.vehicleId ||
      link.routeId,
  );
  if (!hasLink)
    return "Registre o ativo, equipe, veículo ou rota utilizados no atendimento.";
  return null;
}

/** Referências aceitas para o tipo do item, evitando vínculo incoerente. */
export function linkAllowedForKind(
  kind: ResourceRequestItemKind,
  link: FulfillmentLinkInput,
): string | null {
  if (link.assetId && kind !== "ASSET" && kind !== "ASSET_TYPE" && kind !== "MATERIAL")
    return "O vínculo com ativo não é compatível com este tipo de item.";
  if (link.fieldTeamId && kind !== "FIELD_TEAM" && kind !== "TECH_SUPPORT")
    return "O vínculo com equipe não é compatível com este tipo de item.";
  if (link.vehicleId && kind !== "VEHICLE" && kind !== "TRANSPORT")
    return "O vínculo com veículo não é compatível com este tipo de item.";
  if (link.routeId && kind !== "TRANSPORT" && kind !== "MATERIAL")
    return "O vínculo com rota não é compatível com este tipo de item.";
  return null;
}
