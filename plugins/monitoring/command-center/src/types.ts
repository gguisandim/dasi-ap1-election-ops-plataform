import type {
  OperationalAttentionItem,
  OperationalHealth,
  OperationalMetrics,
  OperationalSnapshotPayload,
  OperationalSummary,
  OperationalZoneSituation,
} from "@eops/shared/command-center";

export type OperationalScopeInput = {
  electionId?: string;
  electoralZoneId?: string;
};

export type {
  OperationalAttentionItem,
  OperationalHealth,
  OperationalMetrics,
  OperationalSnapshotPayload,
  OperationalSummary,
  OperationalZoneSituation,
};

export interface SavedViewFilters {
  severity?: string[];
  sourceType?: string[];
  statusState?: string[];
  electionId?: string;
  electoralZoneId?: string;
}

export interface SavedView {
  id: string;
  ownerId: string;
  owner?: { id: string; name: string };
  name: string;
  description?: string | null;
  filters: SavedViewFilters;
  layoutMode: "STANDARD" | "WALLBOARD";
  refreshSeconds: number;
  isDefault: boolean;
  shared: boolean;
  editable: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SavedViewInput {
  name: string;
  description?: string;
  filters?: SavedViewFilters;
  layoutMode?: "STANDARD" | "WALLBOARD";
  refreshSeconds?: number;
  isDefault?: boolean;
  shared?: boolean;
}

export interface SnapshotSummary {
  id: string;
  name: string;
  description?: string | null;
  health: OperationalHealth;
  electionId?: string | null;
  electoralZoneId?: string | null;
  createdAt: string;
  createdBy: { id: string; name: string };
}

export interface SnapshotDetail extends SnapshotSummary {
  payload: OperationalSnapshotPayload;
  election?: { id: string; name: string } | null;
  electoralZone?: { id: string; name: string; number: number } | null;
}

export interface SnapshotComparison {
  snapshot: {
    id: string;
    name: string;
    createdAt: string;
    health: OperationalHealth;
  };
  current: { generatedAt: string; health: OperationalHealth };
  deltas: Array<{ key: string; before: number; after: number; delta: number }>;
}

export interface WorkforceSection {
  available: boolean;
  reason?: "FORBIDDEN";
  shifts: {
    total: number;
    coverageEmpty: number;
    coverageCritical: number;
  } | null;
  dispatches: { active: number; waiting: number } | null;
}

export interface LogisticsSection {
  available: boolean;
  reason?: "FORBIDDEN";
  routes: {
    delayed: number;
    failedDeliveries: number;
    openExceptions: number;
  } | null;
  assets: { lost: number; inMaintenance: number; unavailable: number } | null;
}

export interface ContinuitySection {
  available: boolean;
  reason?: "FORBIDDEN";
  pending?: number;
  oldPending?: number;
  oldestPendingAgeSeconds?: number;
  recentlyConfirmed?: Array<{
    id: string;
    shiftName: string | null;
    confirmedAt: string | null;
  }>;
}

export interface AttentionResponse {
  generatedAt: string;
  health: OperationalHealth;
  metrics: OperationalMetrics;
  criticalItems: OperationalAttentionItem[];
  warnings: OperationalAttentionItem[];
  sections: OperationalSummary["sections"];
}
