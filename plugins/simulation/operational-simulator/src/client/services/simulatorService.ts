import { apiClient } from "@eops/api-client";
import type { ElectionSummary } from "@eops/shared/elections";
import type { IncidentSeverity } from "@eops/shared/incidents";
import {
  SIMULATION_EVENT_TYPE_LABELS,
  SIMULATION_TARGET_TYPES,
  type SimulationComparison,
  type SimulationDecisionKind,
  type SimulationDimension,
  type SimulationEventType,
  type SimulationHealth,
  type SimulationScenarioStatus,
  type SimulationScoreBreakdown,
  type SimulationStatus,
  type SimulationTargetType,
} from "@eops/shared/simulation";

/** Contrato de comparação de execuções, definido em `@eops/shared/simulation`. */
export type { SimulationComparison };

export type FailureProbability = "LOW" | "MEDIUM" | "HIGH";
export type SimulationEventResult = "APPLIED" | "SKIPPED" | "FAILED";

export const FAILURE_PROBABILITY_LABELS: Record<FailureProbability, string> = { LOW: "Baixa", MEDIUM: "Média", HIGH: "Alta" };
export const SEVERITY_ORDER: IncidentSeverity[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
export const RESULT_LABELS: Record<SimulationEventResult, string> = { APPLIED: "Aplicado", SKIPPED: "Ignorado", FAILED: "Falhou" };
export const SIMULATION_EVENT_LABELS = SIMULATION_EVENT_TYPE_LABELS;
export const SIMULATION_TARGETS = SIMULATION_TARGET_TYPES;
export const SIMULATION_STATUS_LABELS: Record<SimulationStatus, string> = { CREATED: "Criada", RUNNING: "Em execução", PAUSED: "Pausada", COMPLETED: "Concluída", FAILED: "Falhou", CANCELLED: "Cancelada" };

export interface SimulationInput { name: string; electionId: string; scenarioId?: string; speed: number; probability: FailureProbability; connectivity: boolean; equipment: boolean; transmission: boolean; logistics: boolean; applyToOperations: boolean; }
export interface SimulationSummary { id: string; name: string; status: SimulationStatus; statusCode: string; speed: number; probability: FailureProbability; elapsedSeconds: number; score: number | null; failureReason: string | null; seed: number | null; createdAt: string; election: { id: string; name: string } | null; scenario: { id: string; name: string } | null; _count: { events: number; incidents: number } | null; }
export interface SimulationRunPage { items: SimulationSummary[]; page: number; pageSize: number; total: number; totalPages: number; }

export interface ScenarioEvent { id: string; scenarioId: string; offsetSeconds: number; type: SimulationEventType; severity: IncidentSeverity | null; targetType: SimulationTargetType; targetId: string | null; probability: number; enabled: boolean; impact: string | null; payload: Record<string, unknown> | null; }
export interface ScenarioEventInput { offsetSeconds: number; type: SimulationEventType; severity?: IncidentSeverity; targetType?: SimulationTargetType; targetId?: string; probability: number; enabled?: boolean; impact?: string; payload?: Record<string, unknown>; }
export interface ScenarioObjectiveInput { key: SimulationDimension; label: string; target: number; direction: "AT_LEAST" | "AT_MOST"; weight: number; }
export interface ScenarioCriterionInput { metric: SimulationDimension; operator: "GTE" | "LTE"; value: number; label: string; }
export interface ScenarioConfigInput { objectives?: ScenarioObjectiveInput[]; successCriteria?: ScenarioCriterionInput[]; failureCriteria?: ScenarioCriterionInput[]; scoreWeights?: Partial<Record<SimulationDimension, number>>; initialConditions?: Record<string, unknown>; }
export interface SimulationScenario { id: string; name: string; description: string | null; active: boolean; status: SimulationScenarioStatus; isTemplate: boolean; version: number; electionId: string | null; clonedFromId: string | null; seed: number | null; durationSeconds: number | null; speed: number; objectives: ScenarioObjectiveInput[] | null; successCriteria: ScenarioCriterionInput[] | null; failureCriteria: ScenarioCriterionInput[] | null; scoreWeights: Partial<Record<SimulationDimension, number>> | null; initialConditions: Record<string, unknown> | null; createdAt: string; updatedAt: string; eventCount?: number; enabledEventCount?: number; events: ScenarioEvent[]; clonedFrom?: { id: string; name: string; version: number } | null; _count?: { simulations: number; clones: number }; }
export interface SimulationScenarioInput extends ScenarioConfigInput { name: string; description?: string; electionId?: string; isTemplate?: boolean; seed?: number; durationSeconds?: number; speed?: number; configuration?: Record<string, unknown>; events?: ScenarioEventInput[]; }

export interface SimulationReportEvent { id: string; offsetSeconds: number; eventType: string; title: string; description: string | null; result: SimulationEventResult | null; severity: IncidentSeverity | null; targetType: string | null; targetId: string | null; incidentId: string | null; assetId: string | null; pollingPlaceId: string | null; incident?: { code: string } | null; asset?: { assetTag: string } | null; pollingPlace?: { name: string } | null; }
export interface SimulationReport { score: number; breakdown: SimulationScoreBreakdown; plannedEvents: number; executedEvents: number; failedEvents: number; incidentsCreated: number; resolvedIncidents: number; transmissionFailures: number; transmissionRecoveries: number; averageRecoverySeconds: number; slaViolations: number; unresolved: number; timeline: SimulationReportEvent[]; }
export interface SimulationEventDetail { id: string; eventType: string; title: string; description: string | null; offsetSeconds: number; result: SimulationEventResult | null; severity: IncidentSeverity | null; payload: Record<string, unknown> | null; incidentId: string | null; assetId: string | null; pollingPlaceId: string | null; incident?: { code: string; status: string } | null; asset?: { assetTag: string; name: string } | null; pollingPlace?: { name: string } | null; }
export interface SimulationDecisionRecord { id: string; offsetSeconds: number; kind: SimulationDecisionKind; rationale: string; payload: Record<string, unknown> | null; createdAt: string; actor?: { id: string; name: string } | null; }
export interface SimulationDecisionInput { kind: SimulationDecisionKind; rationale: string; offsetSeconds?: number; payload?: Record<string, unknown>; }
export interface SimulationSnapshot { id: string; offsetSeconds: number; health: SimulationHealth; metrics: Record<string, unknown> | null; createdAt: string; }
export interface SimulationDetail { id: string; name: string; electionId: string; status: SimulationStatus; statusCode: string; speed: number; probability: FailureProbability; elapsedSeconds: number; applyToOperations: boolean; score: number | null; failureReason: string | null; election: { id: string; name: string }; scenario?: { id: string; name: string } | null; events: SimulationEventDetail[]; incidents: { id: string; code: string; title: string; status: string }[]; snapshots: SimulationSnapshot[]; decisions: SimulationDecisionRecord[]; }
export interface ReplayFrame { offsetSeconds: number; health: SimulationHealth; metrics: Record<string, unknown> | null; events: SimulationReportEvent[]; }
export interface ReplayPlannedEvent { id: string; offsetSeconds: number; type: SimulationEventType; enabled: boolean; status: "EXECUTED" | "PENDING" | "DISABLED"; impact: string | null; }
export interface SimulationReplay { simulationId: string; elapsedSeconds: number; frames: ReplayFrame[]; plannedEvents: ReplayPlannedEvent[]; }
export interface ReplayFrameSnapshot { simulationId: string; offsetSeconds: number; available: boolean; snapshotOffset: number | null; health: SimulationHealth | null; metrics: Record<string, unknown> | null; events: SimulationReportEvent[]; }

export const simulatorService = {
  list: () => apiClient.get<SimulationSummary[]>("/simulations"),
  runs: (query: { electionId?: string; status?: string; scenarioId?: string; page?: number; pageSize?: number } = {}) => apiClient.get<SimulationRunPage>("/simulations/runs", { query }),
  get: (id: string) => apiClient.get<SimulationDetail>(`/simulations/${id}`),
  elections: () => apiClient.get<ElectionSummary[]>("/elections"),
  create: (input: SimulationInput) => apiClient.post<SimulationSummary, SimulationInput>("/simulations", input),
  start: (id: string) => apiClient.post(`/simulations/${id}/start`, {}),
  pause: (id: string) => apiClient.post(`/simulations/${id}/pause`, {}),
  tick: (id: string) => apiClient.post(`/simulations/${id}/tick`, {}),
  step: (id: string) => apiClient.post(`/simulations/${id}/step`, {}),
  cancel: (id: string) => apiClient.post(`/simulations/${id}/cancel`, {}),
  fail: (id: string, reason: string) => apiClient.post(`/simulations/${id}/fail`, { reason }),
  finish: (id: string) => apiClient.post(`/simulations/${id}/finish`, {}),
  report: (id: string) => apiClient.get<SimulationReport>(`/simulations/${id}/report`),
  replay: (id: string) => apiClient.get<SimulationReplay>(`/simulations/${id}/replay`),
  replayFrame: (id: string, offsetSeconds: number) => apiClient.get<ReplayFrameSnapshot>(`/simulations/${id}/replay/frame`, { query: { offsetSeconds } }),
  decisions: (id: string) => apiClient.get<SimulationDecisionRecord[]>(`/simulations/${id}/decisions`),
  recordDecision: (id: string, input: SimulationDecisionInput) => apiClient.post<SimulationDecisionRecord, SimulationDecisionInput>(`/simulations/${id}/decisions`, input),
  compare: (simulationIds: string[]) => apiClient.post<SimulationComparison, { simulationIds: string[] }>("/simulations/compare", { simulationIds }),
  scenarios: (query: { status?: string; isTemplate?: boolean } = {}) => apiClient.get<SimulationScenario[]>("/simulations/scenarios", { query }),
  scenario: (id: string) => apiClient.get<SimulationScenario>(`/simulations/scenarios/${id}`),
  createScenario: (input: SimulationScenarioInput) => apiClient.post<SimulationScenario, SimulationScenarioInput>("/simulations/scenarios", input),
  updateScenario: (id: string, input: Partial<SimulationScenarioInput> & { active?: boolean }) => apiClient.patch<SimulationScenario>(`/simulations/scenarios/${id}`, input),
  deleteScenario: (id: string) => apiClient.delete(`/simulations/scenarios/${id}`),
  cloneScenario: (id: string, input: { name?: string; electionId?: string; isTemplate?: boolean } = {}) => apiClient.post<SimulationScenario, typeof input>(`/simulations/scenarios/${id}/clone`, input),
  publishScenario: (id: string) => apiClient.post<SimulationScenario>(`/simulations/scenarios/${id}/publish`, {}),
  archiveScenario: (id: string) => apiClient.post<SimulationScenario>(`/simulations/scenarios/${id}/archive`, {}),
  addScenarioEvent: (id: string, input: ScenarioEventInput) => apiClient.post<ScenarioEvent, ScenarioEventInput>(`/simulations/scenarios/${id}/events`, input),
  updateScenarioEvent: (id: string, eventId: string, input: { enabled?: boolean; impact?: string }) => apiClient.patch<ScenarioEvent>(`/simulations/scenarios/${id}/events/${eventId}`, input),
  duplicateScenarioEvent: (id: string, eventId: string) => apiClient.post<ScenarioEvent>(`/simulations/scenarios/${id}/events/${eventId}/duplicate`, {}),
  deleteScenarioEvent: (id: string, eventId: string) => apiClient.delete(`/simulations/scenarios/${id}/events/${eventId}`),
};
