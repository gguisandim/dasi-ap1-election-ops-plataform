import type {
  ResourceRequestAction,
  ResourceRequestItemKind,
  ResourceRequestPriority,
  ResourceRequestStatus,
  ResourceRequestUrgency,
} from "@eops/shared/resource-requests";

export type {
  ResourceRequestAction,
  ResourceRequestItemKind,
  ResourceRequestPriority,
  ResourceRequestStatus,
  ResourceRequestUrgency,
};

export interface ResourceRequestItemProgress {
  id: string;
  kind: ResourceRequestItemKind;
  label: string;
  description?: string | null;
  notes?: string | null;
  quantity: number;
  fulfilledQuantity: number;
  remainingQuantity: number;
  satisfied: boolean;
  progressPercent: number;
  assetType?: { id: string; key: string; name: string } | null;
  fieldTeam?: { id: string; code: string; name: string; status: string } | null;
  vehicle?: { id: string; identification: string; plate: string } | null;
  fulfillments: Array<{
    id: string;
    quantity: number;
    notes?: string | null;
    createdAt: string;
    fulfilledBy: { id: string; name: string; email: string };
    asset?: { id: string; assetTag: string; name: string; status: string } | null;
    assetReservation?: { id: string; status: string } | null;
    fieldTeam?: { id: string; code: string; name: string } | null;
    vehicle?: { id: string; identification: string } | null;
    route?: { id: string; code: string; name: string } | null;
    task?: { id: string; title: string } | null;
  }>;
}

export interface ResourceRequestTotals {
  totalRequired: number;
  totalFulfilled: number;
  totalRemaining: number;
  totalItems: number;
  satisfiedItems: number;
  fullySatisfied: boolean;
  anyFulfilled: boolean;
}

export interface ResourceRequestRecord {
  id: string;
  code: string;
  electionId: string;
  electoralZoneId?: string | null;
  pollingPlaceId?: string | null;
  incidentId?: string | null;
  taskId?: string | null;
  title: string;
  description: string;
  priority: ResourceRequestPriority;
  status: ResourceRequestStatus;
  requestedById: string;
  ownerId?: string | null;
  neededAt?: string | null;
  submittedAt?: string | null;
  triagedAt?: string | null;
  approvedAt?: string | null;
  fulfilledAt?: string | null;
  rejectedAt?: string | null;
  cancelledAt?: string | null;
  triageNotes?: string | null;
  rejectionReason?: string | null;
  cancellationReason?: string | null;
  createdAt: string;
  updatedAt: string;
  urgency: ResourceRequestUrgency;
  election: { id: string; name: string; year: number };
  electoralZone?: { id: string; name: string; number: number } | null;
  pollingPlace?: { id: string; name: string } | null;
  incident?: {
    id: string;
    code: string;
    title: string;
    severity: string;
    status: string;
  } | null;
  task?: { id: string; title: string; status: string } | null;
  requestedBy: { id: string; name: string; email: string };
  owner?: { id: string; name: string; email: string } | null;
  items: ResourceRequestItemProgress[];
  totals: ResourceRequestTotals;
  history: Array<{
    id: string;
    action: string;
    description: string;
    metadata?: unknown;
    createdAt: string;
    actor?: { id: string; name: string } | null;
  }>;
  comments: Array<{
    id: string;
    body: string;
    createdAt: string;
    author: { id: string; name: string };
  }>;
}

export interface ResourceRequestDetail extends ResourceRequestRecord {
  availableActions: ResourceRequestAction[];
}

export interface RequestItemInput {
  kind: ResourceRequestItemKind;
  label: string;
  description?: string;
  quantity: number;
  notes?: string;
  assetTypeId?: string;
  fieldTeamId?: string;
  vehicleId?: string;
}

export interface ResourceRequestInput {
  electionId: string;
  electoralZoneId?: string;
  pollingPlaceId?: string;
  incidentId?: string;
  taskId?: string;
  title: string;
  description: string;
  priority?: ResourceRequestPriority;
  neededAt?: string;
  items: RequestItemInput[];
}

export interface FulfillmentInput {
  requestItemId: string;
  quantity: number;
  assetId?: string;
  assetReservationId?: string;
  fieldTeamId?: string;
  vehicleId?: string;
  routeId?: string;
  taskId?: string;
  notes?: string;
}

export interface ResourceRequestReferences {
  elections: Array<{ id: string; name: string; year: number; status: string }>;
  zones: Array<{ id: string; name: string; number: number; electionId: string }>;
  places: Array<{ id: string; name: string; electoralZoneId: string }>;
  incidents: Array<{
    id: string;
    code: string;
    title: string;
    severity: string;
    status: string;
  }>;
  tasks: Array<{ id: string; title: string; status: string; priority: string }>;
  assetTypes: Array<{ id: string; key: string; name: string }>;
  teams: Array<{ id: string; code: string; name: string; electionId: string }>;
  vehicles: Array<{
    id: string;
    identification: string;
    plate: string;
    status: string;
  }>;
  users: Array<{ id: string; name: string; email: string }>;
}

export interface ResourceRequestDashboard {
  generatedAt: string;
  counters: {
    draft: number;
    submitted: number;
    awaitingTriage: number;
    awaitingApproval: number;
    approved: number;
    partiallyFulfilled: number;
    fulfilledToday: number;
    overdue: number;
    critical: number;
  };
  byPriority: Array<{ priority: string; count: number }>;
  byZone: Array<{ zoneId: string; zoneName: string; count: number }>;
  byItemKind: Array<{ kind: string; count: number }>;
  byOwner: Array<{ ownerId: string | null; ownerName: string; count: number }>;
}

export interface PagedRequests {
  items: ResourceRequestRecord[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
