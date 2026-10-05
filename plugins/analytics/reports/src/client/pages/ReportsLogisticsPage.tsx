import { DomainReportPage, chart, num } from "../components/DomainReportPage";
import { reportsService } from "../../services/reportsService";

export function ReportsLogisticsPage() {
  return <DomainReportPage config={{
    title: "Relatório de logística",
    description: "Rotas, entregas, atrasos e exceções apurados sobre as rotas e entregas persistidas.",
    load: reportsService.logistics,
    compareLabels: { routes: "Rotas", deliveries: "Entregas", failed: "Falhas" },
    cards: [
      { label: "Rotas", value: (s) => String(s.totalRoutes ?? 0) },
      { label: "Concluídas", value: (s) => String(s.completedRoutes ?? 0) },
      { label: "Em andamento", value: (s) => String(s.activeRoutes ?? 0) },
      { label: "Atrasadas", value: (s) => String(s.delayedRoutes ?? 0) },
      { label: "Entregas", value: (s) => String(s.deliveries ?? 0) },
      { label: "Entregues", value: (s) => String(s.delivered ?? 0) },
      { label: "Pendentes", value: (s) => String(s.pending ?? 0) },
      { label: "Falhas", value: (s) => String(s.failed ?? 0) },
      { label: "Pontualidade", value: (s) => `${s.onTimeRate ?? 0}%` },
      { label: "Exceções", value: (s) => `${s.exceptionRate ?? 0}%` },
    ],
    charts: [chart("Rotas por status", "byStatus")],
    columns: [
      { label: "Rotas", value: (row) => num(row, "routes") },
      { label: "Concluídas", value: (row) => num(row, "completedRoutes") },
      { label: "Atrasadas", value: (row) => num(row, "delayedRoutes") },
      { label: "Entregas", value: (row) => num(row, "deliveries") },
      { label: "Entregues", value: (row) => num(row, "delivered") },
      { label: "Falhas", value: (row) => num(row, "failed") },
    ],
    placeColumns: [
      { label: "Entregas", value: (row) => num(row, "deliveries") },
      { label: "Entregues", value: (row) => num(row, "delivered") },
      { label: "Falhas", value: (row) => num(row, "failed") },
    ],
  }} />;
}
