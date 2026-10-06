/**
 * Filtros analíticos.
 *
 * `zoneId` é o nome usado pelos endpoints de relatório por domínio e pela UI.
 * `electoralZoneId` é o nome canônico das views persistidas (ver
 * `REPORT_VIEW_FILTER_KEYS` em `@eops/shared/reports`) e das séries temporais.
 * Quando ambos estão presentes, `electoralZoneId` vence.
 */
export interface ReportFilters { from?: string; to?: string; electionId?: string; zoneId?: string; electoralZoneId?: string; pollingPlaceId?: string; categoryId?: string; status?: string; severity?: string; includeSimulated?: boolean; }
export interface SeriesItem { name: string; value: number; }
export type ReportRow = { id: string; label: string; zoneId?: string } & Record<string, unknown>;
export interface ReportBreakdown { byZone: ReportRow[]; byPlace: ReportRow[]; [group: string]: unknown; }
export interface ReportComparison { available: boolean; current: Record<string, number>; previous: Record<string, number> | null; }
export interface DomainReport {
  generatedAt: string;
  period: { from: string | null; to: string | null };
  filters: ReportFilters;
  summary: Record<string, number | string>;
  breakdown: ReportBreakdown;
  comparison: ReportComparison;
}
export interface ExecutiveReport {
  generatedAt: string;
  filters: ReportFilters;
  elections: Array<{ id: string; name: string; year: number }>;
  executive: { operationalPlaces: number; criticalPlaces: number; openIncidents: number; slaPercentage: number; availableAssets: number; unavailableAssets: number; transmissionPercentage: number; routesInProgress: number; delayedDeliveries: number; activeTeams: number; teamsAvailable: boolean };
  incidents: { total: number; open: number; bySeverity: SeriesItem[]; byCategory: SeriesItem[]; byStatus: SeriesItem[]; averageResolutionMinutes: number; slaPercentage: number; timeline: SeriesItem[] };
  inventory: { total: number; byStatus: SeriesItem[]; byCondition: SeriesItem[]; byType: SeriesItem[]; byLocation: SeriesItem[]; movements: number };
  availability: { operationalPlacesPercentage: number; availableAssetsPercentage: number; onlineTransmissionPoints: number };
  transmission: { total: number; completed: number; byStatus: SeriesItem[]; byConnectivity: SeriesItem[] };
  logistics: { totalRoutes: number; activeRoutes: number; delayedRoutes: number };
  byZone: Array<{ id: string; label: string; places: number; criticalPlaces: number; openIncidents: number; assets: number; routesInProgress: number; transmissionPercentage: number; activeTeams: number }>;
  byPlace: Array<{ id: string; label: string; zoneId: string; monitoringStatus: string; openIncidents: number; assets: number; transmissionStatus: string | null }>;
  history: { available: boolean; current: { incidents: number; transmissions: number }; previous: { from: string; to: string; incidents: number; transmissions: number } | null };
}

// ---------------------------------------------------------------------------
// Operational Analytics 2.0 (SPEC 2.2 - 2.8). Contratos espelham @eops/shared/reports.
// ---------------------------------------------------------------------------

export interface SeriesPoint { value: number; sampleSize: number; }

export interface ReportBucket { bucketStart: string; bucketEnd: string; value: number; sampleSize: number; }

export interface ReportSeries {
  metric: string;
  granularity: string;
  from: string;
  to: string;
  bucketCount: number;
  buckets: ReportBucket[];
  totals: SeriesPoint;
}

export interface IndicatorResult { value: number | null; sampleSize: number; }

export interface AnalyticsScope {
  from: string | null;
  to: string | null;
  electionId: string | null;
  electoralZoneId?: string | null;
  pollingPlaceId?: string | null;
  includeSimulated: boolean;
}

export interface SlaReport {
  generatedAt: string;
  scope: AnalyticsScope;
  windowMinutes: number;
  indicators: {
    meanResponseMinutes: IndicatorResult;
    meanResolutionMinutes: IndicatorResult;
    mttrMinutes: IndicatorResult;
    slaCompliancePercent: IndicatorResult;
    deadlineMisses: IndicatorResult;
    escalationRatePercent: IndicatorResult;
    transmissionDowntimeMinutes: IndicatorResult;
    transmissionUptimePercent: IndicatorResult;
    fulfillmentMeanMinutes: IndicatorResult;
    dispatchMeanMinutes: IndicatorResult;
  };
}

export interface ZoneMetricCell { value: number; sampleSize: number; per1000Voters: number | null; perPlace: number | null; }

export interface ZoneRanking { byAbsolute: number | null; byNormalized: number | null; }

export interface ZoneComparisonRow {
  zoneId: string;
  zoneNumber: number;
  zoneName: string;
  municipality: string | null;
  state: string | null;
  pollingPlaceCount: number;
  pollingSectionCount: number;
  registeredVoters: number;
  metrics: Record<string, ZoneMetricCell>;
  rankings: Record<string, ZoneRanking>;
}

export interface ZonesReport {
  generatedAt: string;
  scope: AnalyticsScope;
  zones: ZoneComparisonRow[];
}

export interface DrilldownItem {
  id: string;
  kind: string;
  title: string;
  subtitle: string | null;
  status: string;
  severity: string | null;
  occurredAt: string;
  deepLink: string;
  zoneId?: string;
  pollingPlaceId?: string;
}

export interface DrilldownResult {
  metric: string;
  bucketStart: string;
  bucketEnd: string;
  total: number;
  truncated: boolean;
  items: DrilldownItem[];
}

export interface SavedReportView {
  id: string;
  ownerId: string;
  name: string;
  description: string | null;
  filters: Record<string, unknown>;
  metricsJson: string[];
  granularity: string;
  isDefault: boolean;
  shared: boolean;
  createdAt: string;
  updatedAt: string;
  owner?: { id: string; name: string } | null;
  editable?: boolean;
}

export interface SavedReportViewInput {
  name?: string;
  description?: string;
  filters?: Record<string, unknown>;
  metricsJson?: string[];
  granularity?: string;
  isDefault?: boolean;
  shared?: boolean;
}

export interface ExportJsonResult {
  generatedAt: string;
  scope: AnalyticsScope;
  sections: Record<string, unknown>;
  timeseries: Record<string, ReportBucket[]>;
}
