import { REPORT_METRICS, type ReportMetric } from "@eops/shared/reports";

/** Rotulos pt-BR do vocabulario fechado (SPEC 2.3). */
export const METRIC_LABELS: Record<ReportMetric, string> = {
  incidentsOpened: "Incidentes abertos",
  incidentsOpenedCritical: "Incidentes críticos abertos",
  incidentsResolved: "Incidentes resolvidos",
  incidentsEscalated: "Incidentes escalados",
  incidentsOverdueSla: "Incidentes fora do SLA",
  incidentsActive: "Incidentes ativos",
  transmissionFailures: "Falhas de transmissão",
  transmissionOffline: "Pontos offline",
  transmissionSuccessRate: "Taxa de sucesso de transmissão",
  resourceRequestsCreated: "Solicitações de recursos criadas",
  resourceRequestsFulfilled: "Solicitações atendidas",
  resourceRequestsOverdue: "Solicitações em atraso",
  shiftCoveragePercent: "Cobertura de turnos",
  shiftCoverageEmpty: "Turnos sem cobertura",
  dispatchesActive: "Despachos ativos",
  routesDelayed: "Rotas atrasadas",
  deliveriesFailed: "Entregas falhas",
  deliveriesCompleted: "Entregas concluídas",
  preparationReady: "Checklists prontos",
  preparationBlocked: "Checklists bloqueados",
  assetsLost: "Ativos perdidos",
  assetsInMaintenance: "Ativos em manutenção",
  assetsUnavailable: "Ativos indisponíveis",
};

export function metricLabel(metric: string): string {
  return METRIC_LABELS[metric as ReportMetric] ?? metric;
}

export { REPORT_METRICS };
export type { ReportMetric };
