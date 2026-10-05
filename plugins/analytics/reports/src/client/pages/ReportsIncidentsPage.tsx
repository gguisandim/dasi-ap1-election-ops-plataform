import { DomainReportPage, chart, num } from "../components/DomainReportPage";
import { reportsService } from "../../services/reportsService";

export function ReportsIncidentsPage() {
  return <DomainReportPage config={{
    title: "Relatório de incidentes",
    description: "Volume, severidade, tempo de resolução, SLA, categorias e tendência diária dos incidentes persistidos.",
    load: reportsService.incidents,
    link: { label: "Abrir incidentes", to: "/incidents" },
    compareLabels: { total: "Incidentes", resolved: "Resolvidos" },
    cards: [
      { label: "Incidentes", value: (s) => String(s.total ?? 0) },
      { label: "Abertos", value: (s) => String(s.open ?? 0) },
      { label: "Críticos", value: (s) => String(s.critical ?? 0) },
      { label: "Resolvidos", value: (s) => String(s.resolved ?? 0) },
      { label: "Tempo médio", value: (s) => `${s.averageResolutionMinutes ?? 0} min` },
      { label: "SLA", value: (s) => `${s.slaPercentage ?? 0}%` },
    ],
    charts: [chart("Por severidade", "bySeverity"), chart("Por categoria", "byCategory"), chart("Por status", "byStatus"), chart("Tendência diária", "trend")],
    columns: [
      { label: "Total", value: (row) => num(row, "total") },
      { label: "Abertos", value: (row) => num(row, "open") },
      { label: "Críticos", value: (row) => num(row, "critical") },
      { label: "Resolvidos", value: (row) => num(row, "resolved") },
      { label: "Tempo médio", value: (row) => `${num(row, "averageResolutionMinutes")} min` },
      { label: "SLA", value: (row) => `${num(row, "slaPercentage")}%` },
    ],
    placeColumns: [
      { label: "Total", value: (row) => num(row, "total") },
      { label: "Abertos", value: (row) => num(row, "open") },
      { label: "Críticos", value: (row) => num(row, "critical") },
    ],
  }} />;
}
