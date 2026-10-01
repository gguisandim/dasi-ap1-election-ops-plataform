import { apiClient } from "@eops/api-client";
import type { ElectionSummary, ElectoralZoneSummary, PollingPlaceSummary } from "@eops/shared/elections";
import type { Paginated } from "@eops/shared/common";
import type { Delivery, DeliveryStatus, DistributionRoute, RouteDashboard, RouteFilters, RouteInput, RouteStopStatus, Vehicle } from "../types";

export const routesService = {
  list: (query: RouteFilters = {}) => apiClient.get<DistributionRoute[]>("/routes", { query }),
  dashboard: (query: RouteFilters = {}) => apiClient.get<RouteDashboard>("/routes/dashboard", { query }),
  get: (id: string) => apiClient.get<DistributionRoute>(`/routes/${id}`),
  create: (input: RouteInput) => apiClient.post<DistributionRoute, RouteInput>("/routes", input),
  update: (id: string, input: Partial<RouteInput> & { actualDeparture?: string; actualArrival?: string }) => apiClient.patch<DistributionRoute, typeof input>(`/routes/${id}`, input),
  updateStop: (routeId: string, stopId: string, input: { status: RouteStopStatus; actualAt?: string; notes?: string }) => apiClient.patch(`/routes/${routeId}/stops/${stopId}`, input),
  vehicles: () => apiClient.get<Vehicle[]>("/routes/vehicles"),
  createVehicle: (input: Omit<Vehicle, "id">) => apiClient.post<Vehicle>("/routes/vehicles", input),
  createBatch: (input: { routeId: string; code: string; description?: string }) => apiClient.post("/routes/batches", input),
  createDelivery: (input: { routeId: string; batchId?: string; pollingPlaceId: string; receiverName?: string; notes?: string; items: Array<{ assetId?: string; description: string; quantity: number; lotCode?: string }> }) => apiClient.post<Delivery>("/routes/deliveries", input),
  updateDelivery: (id: string, input: { status: DeliveryStatus; receiverName?: string; deliveredAt?: string; notes?: string; proofUrl?: string; failureReason?: string }) => apiClient.patch<Delivery>(`/routes/deliveries/${id}`, input),
  references: async () => {
    const [elections, zones, places] = await Promise.all([
      apiClient.get<ElectionSummary[]>("/elections"),
      apiClient.get<ElectoralZoneSummary[]>("/electoral-zones"),
      apiClient.get<Paginated<PollingPlaceSummary>>("/polling-places", { query: { pageSize: 100 } }).then((result) => result.items),
    ]);
    return { elections, zones, places };
  },
};
