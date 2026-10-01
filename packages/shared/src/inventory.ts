import type { ElectoralZoneSummary, PollingPlaceSummary } from "./elections";
import type { IncidentSummary } from "./incidents";

export const ASSET_STATUSES = ["AVAILABLE", "ALLOCATED", "IN_TRANSIT", "IN_USE", "MAINTENANCE", "LOST", "RETIRED"] as const;
export const ASSET_CONDITIONS = ["GOOD", "ATTENTION", "DAMAGED", "UNAVAILABLE"] as const;
export type AssetStatus = (typeof ASSET_STATUSES)[number];
export type AssetCondition = (typeof ASSET_CONDITIONS)[number];
export interface AssetTypeSummary { id: string; key: string; name: string; description: string | null; active: boolean; }
export interface AssetMovementSummary { id: string; assetId: string; originLabel: string; destinationLabel: string; responsibleName: string; reason: string; statusBefore: AssetStatus; statusAfter: AssetStatus; movedAt: string; }
export interface AssetSummary { id: string; assetTag: string; name: string; typeId: string; serialNumber: string | null; manufacturer: string | null; model: string | null; status: AssetStatus; condition: AssetCondition; electoralZoneId: string | null; pollingPlaceId: string | null; type: AssetTypeSummary; electoralZone: Pick<ElectoralZoneSummary, "id" | "number" | "name" | "municipality"> | null; pollingPlace: Pick<PollingPlaceSummary, "id" | "name" | "city"> | null; movements?: AssetMovementSummary[]; incidents?: Array<Pick<IncidentSummary, "id" | "code" | "title" | "severity" | "status">>; }
export interface AssetDashboard { total: number; unavailable: number; maintenance: number; inTransit: number; allocated: number; }
export const ASSET_STATUS_LABELS: Record<AssetStatus, string> = { AVAILABLE: "Disponível", ALLOCATED: "Alocado", IN_TRANSIT: "Em trânsito", IN_USE: "Em uso", MAINTENANCE: "Manutenção", LOST: "Extraviado", RETIRED: "Baixado" };
export const ASSET_CONDITION_LABELS: Record<AssetCondition, string> = { GOOD: "Bom", ATTENTION: "Atenção", DAMAGED: "Danificado", UNAVAILABLE: "Indisponível" };
