import { apiClient } from "@eops/api-client";
import type { ElectionSummary, ElectoralZoneSummary, PollingPlaceSummary } from "@eops/shared/elections";
import type { Paginated } from "@eops/shared/common";
import type {
  DomainReport,
  DrilldownResult,
  ExecutiveReport,
  ExportJsonResult,
  ReportFilters,
  ReportSeries,
  SavedReportView,
  SavedReportViewInput,
  SlaReport,
  ZonesReport,
} from "../types";

export interface TimeseriesQuery { metric: string; granularity?: string; from: string; to: string; electionId?: string; electoralZoneId?: string; pollingPlaceId?: string; includeSimulated?: boolean; }
export interface DrilldownQuery { metric: string; from: string; to: string; bucketStart: string; bucketEnd: string; electionId?: string; zoneId?: string; limit?: number; includeSimulated?: boolean; }
export interface ZonesQuery { electionId: string; from?: string; to?: string; metrics?: string; includeSimulated?: boolean; }

function download(blob: Blob, filename: string) { const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url); }

/** SlaQueryDto usa `electoralZoneId`; remapeia os filtros compartilhados. */
function toScopeQuery({ from, to, electionId, zoneId, electoralZoneId, pollingPlaceId, includeSimulated }: ReportFilters) {
  return { from, to, electionId, electoralZoneId: electoralZoneId ?? zoneId, pollingPlaceId, includeSimulated };
}

export const reportsService = {
  executive: (query: ReportFilters = {}) => apiClient.get<ExecutiveReport>("/reports/executive", { query }),
  operations: (query: ReportFilters = {}) => apiClient.get<DomainReport>("/reports/operations", { query }),
  incidents: (query: ReportFilters = {}) => apiClient.get<DomainReport>("/reports/incidents", { query }),
  transmission: (query: ReportFilters = {}) => apiClient.get<DomainReport>("/reports/transmission", { query }),
  workforce: (query: ReportFilters = {}) => apiClient.get<DomainReport>("/reports/workforce", { query }),
  logistics: (query: ReportFilters = {}) => apiClient.get<DomainReport>("/reports/logistics", { query }),
  assets: (query: ReportFilters = {}) => apiClient.get<DomainReport>("/reports/assets", { query }),
  timeseries: (query: TimeseriesQuery) => apiClient.get<ReportSeries>("/reports/timeseries", { query }),
  sla: (query: ReportFilters = {}) => apiClient.get<SlaReport>("/reports/sla", { query: toScopeQuery(query) }),
  zones: (query: ZonesQuery) => apiClient.get<ZonesReport>("/reports/zones", { query }),
  drilldown: (query: DrilldownQuery) => apiClient.get<DrilldownResult>("/reports/drilldown", { query }),
  exportJson: (query: ReportFilters & { metrics?: string } = {}) => apiClient.get<ExportJsonResult>("/reports/export.json", { query }),
  exportCsv: async (query: ReportFilters = {}) => download(await apiClient.getBlob("/reports/export.csv", { query }), "relatorio-election-ops.csv"),
  exportPdf: async (query: ReportFilters = {}) => download(await apiClient.getBlob("/reports/export.pdf", { query }), "relatorio-election-ops.pdf"),
  downloadJson: (data: ExportJsonResult) => { const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }); download(blob, "relatorio-election-ops.json"); },
  views: () => apiClient.get<SavedReportView[]>("/reports/views"),
  createView: (input: SavedReportViewInput) => apiClient.post<SavedReportView, SavedReportViewInput>("/reports/views", input),
  updateView: (id: string, input: SavedReportViewInput) => apiClient.patch<SavedReportView, SavedReportViewInput>(`/reports/views/${id}`, input),
  removeView: (id: string) => apiClient.delete<{ id: string; deleted: boolean }>(`/reports/views/${id}`),
  currentUser: () => apiClient.get<{ id: string; name: string; permissions: string[] }>("/auth/me"),
  references: async () => {
    const [elections, zones, places, categories] = await Promise.all([
      apiClient.get<ElectionSummary[]>("/elections"), apiClient.get<ElectoralZoneSummary[]>("/electoral-zones"),
      apiClient.get<Paginated<PollingPlaceSummary>>("/polling-places", { query: { pageSize: 100 } }).then((result) => result.items),
      apiClient.get<Array<{ id: string; name: string }>>("/incidents/categories"),
    ]);
    return { elections, zones, places, categories };
  },
};
