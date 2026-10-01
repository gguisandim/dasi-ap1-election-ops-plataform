import { apiClient } from "@eops/api-client";
import type { AssetCondition, AssetDashboard, AssetStatus, AssetSummary, AssetTypeSummary, ElectoralZoneSummary, Paginated, PollingPlaceSummary } from "@eops/shared";

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
  createType: (input: { key: string; name: string; description?: string }) => apiClient.post<AssetTypeSummary>("/inventory/types", input),
  referenceLocations: async () => {
    const [zones, places] = await Promise.all([
      apiClient.get<ElectoralZoneSummary[]>("/electoral-zones"),
      apiClient.get<Paginated<PollingPlaceSummary>>("/polling-places", { query: { pageSize: 100 } }).then((result) => result.items),
    ]);
    return { zones, places };
  },
};
