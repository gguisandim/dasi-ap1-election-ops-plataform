import { DomainReportPage, chart, num } from "../components/DomainReportPage";
import { reportsService } from "../../services/reportsService";

export function ReportsAssetsPage() {
  return <DomainReportPage config={{
    title: "Relatório de ativos",
    description: "Status, movimentações, distribuição e disponibilidade dos ativos persistidos no inventário.",
    load: reportsService.assets,
    compareLabels: { movements: "Movimentações" },
    cards: [
      { label: "Ativos", value: (s) => String(s.total ?? 0) },
      { label: "Disponíveis", value: (s) => String(s.available ?? 0) },
      { label: "Alocados", value: (s) => String(s.allocated ?? 0) },
      { label: "Em uso", value: (s) => String(s.inUse ?? 0) },
      { label: "Manutenção", value: (s) => String(s.maintenance ?? 0) },
      { label: "Perdidos", value: (s) => String(s.lost ?? 0) },
      { label: "Boa condição", value: (s) => String(s.goodCondition ?? 0) },
      { label: "Movimentações", value: (s) => String(s.movements ?? 0) },
      { label: "Disponibilidade", value: (s) => `${s.availabilityRate ?? 0}%` },
    ],
    charts: [chart("Por status", "byStatus"), chart("Por condição", "byCondition"), chart("Por tipo", "byType")],
    columns: [
      { label: "Total", value: (row) => num(row, "total") },
      { label: "Disponíveis", value: (row) => num(row, "available") },
      { label: "Alocados", value: (row) => num(row, "allocated") },
      { label: "Manutenção", value: (row) => num(row, "maintenance") },
      { label: "Movimentações", value: (row) => num(row, "movements") },
    ],
    placeColumns: [
      { label: "Total", value: (row) => num(row, "total") },
      { label: "Disponíveis", value: (row) => num(row, "available") },
      { label: "Manutenção", value: (row) => num(row, "maintenance") },
      { label: "Movimentações", value: (row) => num(row, "movements") },
    ],
  }} />;
}
