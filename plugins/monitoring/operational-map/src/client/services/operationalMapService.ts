import { apiClient } from "@eops/api-client";
import type { ElectoralZoneSummary } from "@eops/shared/elections";
import type { IncidentSeverity } from "@eops/shared/incidents";
import { OPERATIONAL_MAP_TYPES, type OperationalMapFeature, type OperationalMapFeatureType } from "../../shared/types/operational-map";

export interface MapFiltersValue {
  zoneId: string;
  status: string;
  severity: "" | IncidentSeverity;
}

export const emptyMapFilters: MapFiltersValue = { zoneId: "", status: "", severity: "" };

export const allLayers: OperationalMapFeatureType[] = [...OPERATIONAL_MAP_TYPES];

export interface FeaturesQuery extends MapFiltersValue {
  types?: OperationalMapFeatureType[];
}

export const operationalMapService = {
  zones: () => apiClient.get<ElectoralZoneSummary[]>("/electoral-zones"),
  features: (query: FeaturesQuery) =>
    apiClient.get<OperationalMapFeature[]>("/operational-map/features", {
      query: {
        zoneId: query.zoneId,
        status: query.status,
        severity: query.severity,
        types: query.types?.length ? query.types.join(",") : undefined,
      },
    }),
};
