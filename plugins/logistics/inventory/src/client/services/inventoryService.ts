import { apiClient } from "@eops/api-client";
import type { AssetCondition, AssetDashboard, AssetMaintenanceSummary, AssetReservationSummary, AssetStatus, AssetSummary, AssetTypeSummary } from "@eops/shared/inventory";
import type { ElectoralZoneSummary, PollingPlaceSummary } from "@eops/shared/elections";
import type { Paginated } from "@eops/shared/common";

export interface AssetFilters { search?: string; typeId?: string; status?: AssetStatus; condition?: AssetCondition; zoneId?: string; pollingPlaceId?: string; page?: number; pageSize?: number; }
export interface AssetInput { assetTag: string; name: string; typeId: string; serialNumber?: string; manufacturer?: string; model?: string; status: AssetStatus; condition: AssetCondition; electoralZoneId?: string; pollingPlaceId?: string; }
export interface MoveAssetInput { toZoneId?: string; toPollingPlaceId?: string; responsibleName: string; reason: string; statusAfter?: AssetStatus; movedAt?: string; }

export const inventoryService = {
  list: (query: AssetFilters = {}) => apiClient.get<Paginated<AssetSummary>>("/inventory", { query }),
  dashboard: () => apiClient.get<AssetDashboard>("/inventory/dashboard"),
  types: () => apiClient.get<AssetTypeSummary[]>("/inventory/types"),
  get: (id: string) => apiClient.get<AssetSummary>(`/inventory/${id}`),
  create: (input: AssetInput) => apiClient.post<AssetSummary, AssetInput>("/inventory", input),
  update: (id: string, input: Partial<Omit<AssetInput, "assetTag" | "electoralZoneId" | "pollingPlaceId">>) => apiClient.patch<AssetSummary, typeof input>(`/inventory/${id}`, input),
  move: (id: string, input: MoveAssetInput) => apiClient.post(`/inventory/${id}/movements`, input),
  reservations: () => apiClient.get<AssetReservationSummary[]>("/inventory/reservations"),
  createReservation: (input: { assetId: string; requesterName: string; purpose: string; startsAt: string; endsAt: string; notes?: string }) => apiClient.post<AssetReservationSummary>("/inventory/reservations", input),
  approveReservation: (id: string) => apiClient.post<AssetReservationSummary>(`/inventory/reservations/${id}/approve`, {}),
  cancelReservation: (id: string, notes?: string) => apiClient.post<AssetReservationSummary>(`/inventory/reservations/${id}/cancel`, { notes }),
  maintenance: () => apiClient.get<AssetMaintenanceSummary[]>("/inventory/maintenance"),
  createMaintenance: (input: { assetId: string; type: "PREVENTIVE" | "CORRECTIVE"; description: string; responsible: string; cost?: number; notes?: string }) => apiClient.post<AssetMaintenanceSummary>("/inventory/maintenance", input),
  startMaintenance: (id: string) => apiClient.post<AssetMaintenanceSummary>(`/inventory/maintenance/${id}/start`, {}),
  completeMaintenance: (id: string, input: { returnToService: boolean; result: string; notes?: string }) => apiClient.post<AssetMaintenanceSummary>(`/inventory/maintenance/${id}/complete`, input),
  cancelMaintenance: (id: string) => apiClient.post<AssetMaintenanceSummary>(`/inventory/maintenance/${id}/cancel`, {}),
  checkOut: (id: string, input: { reservationId?: string; responsibleName: string; purpose: string; origin: string; destination: string; expectedReturnAt?: string; conditionOut: AssetCondition; notes?: string }) => apiClient.post(`/inventory/${id}/check-out`, input),
  checkIn: (id: string, input: { conditionIn: AssetCondition; returnedTo: string; receivedByName: string; problemDetected?: boolean; notes?: string }) => apiClient.post(`/inventory/${id}/check-in`, input),
  createType: (input: { key: string; name: string; description?: string }) => apiClient.post<AssetTypeSummary>("/inventory/types", input),
  referenceLocations: async () => {
    const [zones, places] = await Promise.all([
      apiClient.get<ElectoralZoneSummary[]>("/electoral-zones"),
      apiClient.get<Paginated<PollingPlaceSummary>>("/polling-places", { query: { pageSize: 100 } }).then((result) => result.items),
    ]);
    return { zones, places };
  },
};
