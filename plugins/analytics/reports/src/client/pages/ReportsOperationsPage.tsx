import { DomainReportPage, num } from "../components/DomainReportPage";
import { reportsService } from "../../services/reportsService";

export function ReportsOperationsPage() {
  return <DomainReportPage config={{
    title: "Relatório de operações",
    description: "Visão combinada de incidentes, transmissão, equipes, tarefas, ativos e rotas sobre dados persistidos.",
    load: reportsService.operations,
    link: { label: "Abrir incidentes", to: "/incidents" },
    compareLabels: { incidents: "Incidentes", tasks: "Tarefas", routes: "Rotas" },
    cards: [
      { label: "Incidentes", value: (s) => String(s.incidents ?? 0) },
      { label: "Incidentes abertos", value: (s) => String(s.openIncidents ?? 0) },
      { label: "Pontos de transmissão", value: (s) => String(s.transmissionPoints ?? 0) },
      { label: "Transmissão OK", value: (s) => `${s.transmissionSuccessRate ?? 0}%` },
      { label: "Equipes ativas", value: (s) => String(s.activeTeams ?? 0) },
      { label: "Tarefas", value: (s) => String(s.tasks ?? 0) },
      { label: "Tarefas atrasadas", value: (s) => String(s.tasksOverdue ?? 0) },
      { label: "Ativos disponíveis", value: (s) => String(s.availableAssets ?? 0) },
      { label: "Rotas", value: (s) => String(s.routes ?? 0) },
      { label: "Rotas atrasadas", value: (s) => String(s.delayedRoutes ?? 0) },
    ],
    columns: [
      { label: "Incidentes", value: (row) => num(row, "incidents") },
      { label: "Abertos", value: (row) => num(row, "openIncidents") },
      { label: "Transmissão", value: (row) => num(row, "transmissionPoints") },
      { label: "Sucesso", value: (row) => `${num(row, "transmissionSuccessRate")}%` },
      { label: "Equipes", value: (row) => num(row, "activeTeams") },
      { label: "Tarefas", value: (row) => num(row, "tasks") },
      { label: "Ativos", value: (row) => num(row, "assets") },
      { label: "Rotas", value: (row) => num(row, "routes") },
    ],
    placeColumns: [
      { label: "Incidentes", value: (row) => num(row, "incidents") },
      { label: "Transmissão", value: (row) => num(row, "transmissionPoints") },
      { label: "Ativos", value: (row) => num(row, "assets") },
    ],
  }} />;
}
