import { apiClient } from "@eops/api-client";
import type { ElectionSummary, ElectoralZoneSummary, PollingPlaceSummary } from "@eops/shared/elections";
import type { Paginated } from "@eops/shared/common";
import type { ExecutiveReport, ReportFilters } from "../types";

function download(blob: Blob, filename: string) { const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url); }

export const reportsService = {
  executive: (query: ReportFilters = {}) => apiClient.get<ExecutiveReport>("/reports/executive", { query }),
  exportCsv: async (query: ReportFilters = {}) => download(await apiClient.getBlob("/reports/export.csv", { query }), "relatorio-election-ops.csv"),
  exportPdf: async (query: ReportFilters = {}) => download(await apiClient.getBlob("/reports/export.pdf", { query }), "relatorio-election-ops.pdf"),
  references: async () => {
    const [elections, zones, places, categories] = await Promise.all([
      apiClient.get<ElectionSummary[]>("/elections"), apiClient.get<ElectoralZoneSummary[]>("/electoral-zones"),
      apiClient.get<Paginated<PollingPlaceSummary>>("/polling-places", { query: { pageSize: 100 } }).then((result) => result.items),
      apiClient.get<Array<{ id: string; name: string }>>("/incidents/categories"),
    ]);
    return { elections, zones, places, categories };
  },
};
