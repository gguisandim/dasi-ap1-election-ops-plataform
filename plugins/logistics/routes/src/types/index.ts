export const ROUTE_STATUSES = ["PLANNED", "READY", "DISPATCHED", "IN_PROGRESS", "DELAYED", "COMPLETED", "CANCELLED"] as const;
export const DELIVERY_STATUSES = ["PENDING", "IN_TRANSIT", "DELIVERED", "FAILED", "RETURNED"] as const;
export type RouteStatus = (typeof ROUTE_STATUSES)[number];
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];
export type RouteStopStatus = "PENDING" | "ARRIVED" | "COMPLETED" | "FAILED" | "SKIPPED";
export type VehicleStatus = "AVAILABLE" | "ASSIGNED" | "IN_TRANSIT" | "MAINTENANCE" | "UNAVAILABLE";

export const ROUTE_STATUS_LABELS: Record<RouteStatus, string> = {
  PLANNED: "Planejada",
  READY: "Pronta",
  DISPATCHED: "Despachada",
  IN_PROGRESS: "Em andamento",
  DELAYED: "Atrasada",
  COMPLETED: "Concluída",
  CANCELLED: "Cancelada",
};
export const DELIVERY_STATUS_LABELS: Record<DeliveryStatus, string> = {
  PENDING: "Pendente",
  IN_TRANSIT: "Em trânsito",
  DELIVERED: "Entregue",
  FAILED: "Falhou",
  RETURNED: "Recolhida",
};

export interface Vehicle { id: string; identification: string; plate: string; model: string; capacity: number | null; status: VehicleStatus; driverName: string | null; responsibleName: string | null; }
export interface RouteStop { id: string; order: number; pollingPlaceId: string | null; description: string; latitude: string | number | null; longitude: string | number | null; eta: string; actualAt: string | null; status: RouteStopStatus; notes: string | null; pollingPlace: { id: string; name: string; address: string } | null; }
export interface DeliveryItem { id: string; assetId: string | null; description: string; quantity: number; lotCode: string | null; asset: { id: string; assetTag: string; name: string } | null; }
export interface Delivery { id: string; routeId: string; batchId: string | null; pollingPlaceId: string; status: DeliveryStatus; receiverName: string | null; deliveredAt: string | null; notes: string | null; proofUrl: string | null; failureReason: string | null; handledById: string | null; pollingPlace: { id: string; name: string }; items: DeliveryItem[]; }
export interface DeliveryBatch { id: string; code: string; description: string | null; itemCount: number; placesCount: number; pendingCount: number; completedCount: number; failedCount: number; }
export interface RouteHistory { id: string; type: string; message: string; actorId: string | null; createdAt: string; }
export interface RouteException { id: string; routeId: string; stopId: string | null; deliveryId: string | null; reason: string; notes: string | null; occurredAt: string; resolvedAt: string | null; resolution: string | null; }
export interface DistributionRoute { id: string; code: string; name: string; electionId: string; electoralZoneId: string; description: string | null; originName: string; originLatitude: string | number | null; originLongitude: string | number | null; destinationName: string; destinationLatitude: string | number | null; destinationLongitude: string | number | null; plannedDeparture: string; plannedArrival: string; actualDeparture: string | null; actualArrival: string | null; responsibleName: string; driverName: string | null; vehicleId: string | null; notes: string | null; status: RouteStatus; delayMinutes: number; deliveryRisk: "ON_TIME" | "AT_RISK" | "DELAYED"; loadUnits: number; assetsInTransit: number; capacityExceeded: boolean; openExceptions: number; availableActions: RouteStatus[]; election: { id: string; name: string; year: number }; electoralZone: { id: string; number: number; name: string; municipality: string }; vehicle: Vehicle | null; stops: RouteStop[]; deliveries: Delivery[]; batches: DeliveryBatch[]; history: RouteHistory[]; exceptions: RouteException[]; }
export interface RouteDashboard { total: number; ready: number; dispatched: number; inProgress: number; atRisk: number; delayed: number; completed: number; pendingDeliveries: number; failedDeliveries: number; openExceptions: number; assetsInTransit: number; }
export interface RouteFilters { electionId?: string; zoneId?: string; status?: RouteStatus; responsible?: string; from?: string; to?: string; }
export interface RouteInput { code: string; name: string; electionId: string; electoralZoneId: string; description?: string; originName: string; originLatitude?: number; originLongitude?: number; destinationName: string; destinationLatitude?: number; destinationLongitude?: number; plannedDeparture: string; plannedArrival: string; responsibleName: string; driverName?: string; vehicleId?: string; notes?: string; stops?: Array<{ order: number; pollingPlaceId?: string; description: string; latitude?: number; longitude?: number; eta: string; notes?: string }>; }
