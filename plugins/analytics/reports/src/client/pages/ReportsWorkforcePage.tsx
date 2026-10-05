import { DomainReportPage, chart, num } from "../components/DomainReportPage";
import { reportsService } from "../../services/reportsService";

export function ReportsWorkforcePage() {
  return <DomainReportPage config={{
    title: "Relatório de equipes",
    description: "Cobertura, alocações, despachos, tempo de resposta, utilização e disponibilidade das equipes de campo.",
    load: reportsService.workforce,
    link: { label: "Abrir equipes", to: "/field-teams" },
    compareLabels: { dispatches: "Dispatches", allocations: "Alocações" },
    cards: [
      { label: "Equipes", value: (s) => String(s.teams ?? 0) },
      { label: "Equipes ativas", value: (s) => String(s.activeTeams ?? 0) },
      { label: "Disponibilidade", value: (s) => `${s.availabilityRate ?? 0}%` },
      { label: "Alocações", value: (s) => String(s.allocations ?? 0) },
      { label: "Alocações ativas", value: (s) => String(s.activeAllocations ?? 0) },
      { label: "Cobertura", value: (s) => `${s.coverageRate ?? 0}%` },
      { label: "Dispatches", value: (s) => String(s.dispatches ?? 0) },
      { label: "Dispatches concluídos", value: (s) => String(s.completedDispatches ?? 0) },
      { label: "Tempo de resposta", value: (s) => `${s.averageResponseMinutes ?? 0} min` },
      { label: "Utilização", value: (s) => `${s.utilizationRate ?? 0}%` },
    ],
    charts: [chart("Dispatches por status", "byStatus")],
    columns: [
      { label: "Alocações", value: (row) => num(row, "allocations") },
      { label: "Ativas", value: (row) => num(row, "activeAllocations") },
      { label: "Dispatches", value: (row) => num(row, "dispatches") },
      { label: "Tempo de resposta", value: (row) => `${num(row, "averageResponseMinutes")} min` },
      { label: "Utilização", value: (row) => `${num(row, "utilizationRate")}%` },
    ],
    placeColumns: [
      { label: "Alocações", value: (row) => num(row, "allocations") },
      { label: "Dispatches", value: (row) => num(row, "dispatches") },
    ],
  }} />;
}
