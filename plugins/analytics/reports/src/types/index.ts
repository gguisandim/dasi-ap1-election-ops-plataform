export interface ReportFilters { from?: string; to?: string; electionId?: string; zoneId?: string; pollingPlaceId?: string; categoryId?: string; status?: string; severity?: string; }
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
