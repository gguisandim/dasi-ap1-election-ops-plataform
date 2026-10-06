import type { ElectoralZoneSummary, PollingPlaceSummary } from "./elections";
import type { IncidentSummary } from "./incidents";

export const ASSET_STATUSES = ["AVAILABLE", "ALLOCATED", "IN_TRANSIT", "IN_USE", "MAINTENANCE", "LOST", "RETIRED"] as const;
export const ASSET_CONDITIONS = ["GOOD", "ATTENTION", "DAMAGED", "UNAVAILABLE"] as const;
export type AssetStatus = (typeof ASSET_STATUSES)[number];
export type AssetCondition = (typeof ASSET_CONDITIONS)[number];
export type AssetOperationalState = AssetStatus | "RESERVED" | "IN_CUSTODY" | "OVERDUE" | "UNAVAILABLE";
export type AssetReservationStatus = "REQUESTED" | "APPROVED" | "FULFILLED" | "CANCELLED";
export type AssetMaintenanceStatus = "OPEN" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
export type AssetMaintenanceType = "PREVENTIVE" | "CORRECTIVE";
export interface AssetTypeSummary { id: string; key: string; name: string; description: string | null; active: boolean; }
export interface AssetMovementSummary { id: string; assetId: string; originLabel: string; destinationLabel: string; responsibleName: string; reason: string; statusBefore: AssetStatus; statusAfter: AssetStatus; movedAt: string; }
export interface AssetAssignmentSummary { id: string; kind: "ALLOCATION" | "CUSTODY"; assignedToId: string | null; assignedToName: string | null; purpose: string | null; originLabel: string | null; destinationLabel: string | null; expectedReturnAt: string | null; conditionOut: AssetCondition | null; conditionIn: AssetCondition | null; returnedAt: string | null; returnedTo: string | null; receivedByName: string | null; problemDetected: boolean; assignedAt: string; endedAt: string | null; }
export interface AssetReservationSummary { id: string; assetId: string; requesterName: string; purpose: string; startsAt: string; endsAt: string; status: AssetReservationStatus; notes: string | null; approvedAt: string | null; cancelledAt: string | null; asset?: AssetSummary; }
export interface AssetMaintenanceSummary { id: string; assetId: string; type: AssetMaintenanceType; status: AssetMaintenanceStatus; description: string; responsible: string; cost: string | number | null; result: string | null; notes: string | null; openedAt: string; startedAt: string | null; completedAt: string | null; asset?: AssetSummary; }
export interface AssetSummary { id: string; assetTag: string; name: string; typeId: string; serialNumber: string | null; manufacturer: string | null; model: string | null; status: AssetStatus; condition: AssetCondition; operationalState: AssetOperationalState; availableActions: { checkOut: boolean; checkIn: boolean; reserve: boolean; openMaintenance: boolean }; electoralZoneId: string | null; pollingPlaceId: string | null; type: AssetTypeSummary; electoralZone: Pick<ElectoralZoneSummary, "id" | "number" | "name" | "municipality"> | null; pollingPlace: Pick<PollingPlaceSummary, "id" | "name" | "city"> | null; movements?: AssetMovementSummary[]; assignments?: AssetAssignmentSummary[]; reservations?: AssetReservationSummary[]; maintenances?: AssetMaintenanceSummary[]; incidents?: Array<Pick<IncidentSummary, "id" | "code" | "title" | "severity" | "status">>; }
export interface AssetDashboard { total: number; unavailable: number; maintenance: number; inTransit: number; allocated: number; checkedOut: number; overdue: number; reservations: number; recentMovements: Array<AssetMovementSummary & { asset: Pick<AssetSummary, "id" | "assetTag" | "name"> }>; }
export const ASSET_STATUS_LABELS: Record<AssetStatus, string> = { AVAILABLE: "Disponível", ALLOCATED: "Alocado", IN_TRANSIT: "Em trânsito", IN_USE: "Em uso", MAINTENANCE: "Manutenção", LOST: "Extraviado", RETIRED: "Baixado" };
export const ASSET_CONDITION_LABELS: Record<AssetCondition, string> = { GOOD: "Bom", ATTENTION: "Atenção", DAMAGED: "Danificado", UNAVAILABLE: "Indisponível" };
