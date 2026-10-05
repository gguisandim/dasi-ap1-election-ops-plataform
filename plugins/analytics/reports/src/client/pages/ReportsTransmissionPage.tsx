import { DomainReportPage, chart, num } from "../components/DomainReportPage";
import { reportsService } from "../../services/reportsService";

export function ReportsTransmissionPage() {
  return <DomainReportPage config={{
    title: "Relatório de transmissão",
    description: "Taxas de sucesso e falha, latência, retentativas, períodos offline e violações de prazo dos pontos de transmissão.",
    load: reportsService.transmission,
    link: { label: "Abrir transmissão", to: "/transmission" },
    compareLabels: { total: "Pontos", success: "Sucesso" },
    cards: [
      { label: "Pontos", value: (s) => String(s.total ?? 0) },
      { label: "Sucesso", value: (s) => String(s.success ?? 0) },
      { label: "Falhas", value: (s) => String(s.failed ?? 0) },
      { label: "Offline", value: (s) => String(s.offlinePoints ?? 0) },
      { label: "Taxa de sucesso", value: (s) => `${s.successRate ?? 0}%` },
      { label: "Taxa de falha", value: (s) => `${s.failureRate ?? 0}%` },
      { label: "Latência média", value: (s) => `${s.averageLatencyMs ?? 0} ms` },
      { label: "Retentativas", value: (s) => `${s.retryRate ?? 0}%` },
      { label: "Violações de prazo", value: (s) => String(s.deadlineViolations ?? 0) },
      { label: "Tentativas hoje", value: (s) => String(s.attemptsToday ?? 0) },
    ],
    charts: [chart("Por status", "byStatus"), chart("Conectividade", "byConnectivity")],
    columns: [
      { label: "Total", value: (row) => num(row, "total") },
      { label: "Sucesso", value: (row) => num(row, "success") },
      { label: "Falhas", value: (row) => num(row, "failed") },
      { label: "Offline", value: (row) => num(row, "offline") },
      { label: "Taxa de sucesso", value: (row) => `${num(row, "successRate")}%` },
      { label: "Latência", value: (row) => `${num(row, "averageLatencyMs")} ms` },
      { label: "Violações", value: (row) => num(row, "deadlineViolations") },
    ],
    placeColumns: [
      { label: "Total", value: (row) => num(row, "total") },
      { label: "Sucesso", value: (row) => num(row, "success") },
      { label: "Falhas", value: (row) => num(row, "failed") },
      { label: "Offline", value: (row) => num(row, "offline") },
      { label: "Violações", value: (row) => num(row, "deadlineViolations") },
    ],
  }} />;
}
