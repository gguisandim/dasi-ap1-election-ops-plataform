import { apiClient } from "@eops/api-client";
import type { ElectionSummary } from "@eops/shared/elections";
import type { IncidentSeverity } from "@eops/shared/incidents";
import type { FailureProbability, SimulationStatus, SimulationSummary } from "@eops/shared/simulation";

export type SimulationScenarioEventType = "INCIDENT_CREATE" | "TRANSMISSION_FAILURE" | "TRANSMISSION_RECOVERY" | "ASSET_FAILURE" | "ASSET_RECOVERY";
export type SimulationTargetType = "NONE" | "POLLING_PLACE" | "ZONE" | "ASSET" | "TRANSMISSION";
export type SimulationEventResult = "APPLIED" | "SKIPPED" | "FAILED";

export interface SimulationInput { name: string; electionId: string; scenarioId?: string; speed: number; probability: FailureProbability; connectivity: boolean; equipment: boolean; transmission: boolean; logistics: boolean; applyToOperations: boolean; }
export interface ScenarioEvent { id: string; scenarioId: string; offsetSeconds: number; type: SimulationScenarioEventType; severity: IncidentSeverity | null; targetType: SimulationTargetType; targetId: string | null; probability: number; payload: Record<string, unknown> | null; }
export interface ScenarioEventInput { offsetSeconds: number; type: SimulationScenarioEventType; severity?: IncidentSeverity; targetType?: SimulationTargetType; targetId?: string; probability: number; payload?: Record<string, unknown>; }
export interface SimulationScenario { id: string; name: string; description: string | null; active: boolean; seed: number | null; durationSeconds: number | null; createdAt: string; updatedAt: string; events: ScenarioEvent[]; _count?: { simulations: number }; }
export interface SimulationScenarioInput { name: string; description?: string; seed?: number; durationSeconds?: number; configuration?: Record<string, unknown>; events?: ScenarioEventInput[]; }
export interface SimulationReportEvent { id: string; offsetSeconds: number; eventType: string; title: string; description: string | null; result: SimulationEventResult | null; severity: IncidentSeverity | null; targetType: string | null; targetId: string | null; incidentId: string | null; assetId: string | null; pollingPlaceId: string | null; incident?: { code: string } | null; asset?: { assetTag: string } | null; pollingPlace?: { name: string } | null; }
export interface SimulationReport { score: number; breakdown: Record<string, number>; plannedEvents: number; executedEvents: number; failedEvents: number; incidentsCreated: number; resolvedIncidents: number; transmissionFailures: number; transmissionRecoveries: number; averageRecoverySeconds: number; slaViolations: number; unresolved: number; timeline: SimulationReportEvent[]; }
export interface SimulationEventDetail { id: string; eventType: string; title: string; description: string | null; offsetSeconds: number; result: SimulationEventResult | null; severity: IncidentSeverity | null; payload: Record<string, unknown> | null; incidentId: string | null; assetId: string | null; pollingPlaceId: string | null; incident?: { code: string; status: string } | null; asset?: { assetTag: string; name: string } | null; pollingPlace?: { name: string } | null; }
export interface SimulationDetail { id: string; name: string; electionId: string; status: SimulationStatus; speed: number; probability: FailureProbability; elapsedSeconds: number; applyToOperations: boolean; score: number | null; election: { id: string; name: string }; scenario?: { id: string; name: string } | null; events: SimulationEventDetail[]; incidents: { id: string; code: string; title: string; status: string }[]; }

export const SIMULATION_SPEEDS = [1, 2, 5, 10, 20, 100];
export const SCENARIO_EVENT_TYPES: SimulationScenarioEventType[] = ["INCIDENT_CREATE", "TRANSMISSION_FAILURE", "TRANSMISSION_RECOVERY", "ASSET_FAILURE", "ASSET_RECOVERY"];
export const TARGETS_BY_TYPE: Record<SimulationScenarioEventType, SimulationTargetType[]> = {
  INCIDENT_CREATE: ["POLLING_PLACE", "ZONE", "ASSET"],
  ASSET_FAILURE: ["ASSET"],
  ASSET_RECOVERY: ["ASSET"],
  TRANSMISSION_FAILURE: ["TRANSMISSION"],
  TRANSMISSION_RECOVERY: ["TRANSMISSION"],
};
export const SCENARIO_EVENT_TYPE_LABELS: Record<SimulationScenarioEventType, string> = { INCIDENT_CREATE: "Criar incidente", TRANSMISSION_FAILURE: "Falha de transmissão", TRANSMISSION_RECOVERY: "Recuperação de transmissão", ASSET_FAILURE: "Falha de ativo", ASSET_RECOVERY: "Recuperação de ativo" };
export const TARGET_TYPE_LABELS: Record<SimulationTargetType, string> = { NONE: "Sem alvo", POLLING_PLACE: "Local de votação", ZONE: "Zona", ASSET: "Ativo", TRANSMISSION: "Ponto de transmissão" };
export const SEVERITY_LABELS: Record<IncidentSeverity, string> = { LOW: "Baixa", MEDIUM: "Média", HIGH: "Alta", CRITICAL: "Crítica" };
export const RESULT_LABELS: Record<SimulationEventResult, string> = { APPLIED: "Aplicado", SKIPPED: "Ignorado", FAILED: "Falhou" };

export const simulatorService = {
  list: () => apiClient.get<SimulationSummary[]>("/simulations"), get: (id: string) => apiClient.get<SimulationDetail>(`/simulations/${id}`),
  elections: () => apiClient.get<ElectionSummary[]>("/elections"), create: (input: SimulationInput) => apiClient.post<SimulationSummary, SimulationInput>("/simulations", input),
  start: (id: string) => apiClient.post(`/simulations/${id}/start`, {}), pause: (id: string) => apiClient.post(`/simulations/${id}/pause`, {}),
  tick: (id: string) => apiClient.post(`/simulations/${id}/tick`, {}), finish: (id: string) => apiClient.post(`/simulations/${id}/finish`, {}),
  report: (id: string) => apiClient.get<SimulationReport>(`/simulations/${id}/report`),
  scenarios: () => apiClient.get<SimulationScenario[]>("/simulations/scenarios"),
  scenario: (id: string) => apiClient.get<SimulationScenario>(`/simulations/scenarios/${id}`),
  createScenario: (input: SimulationScenarioInput) => apiClient.post<SimulationScenario, SimulationScenarioInput>("/simulations/scenarios", input),
  updateScenario: (id: string, input: Partial<Pick<SimulationScenarioInput, "name" | "description" | "seed" | "durationSeconds">> & { active?: boolean }) => apiClient.patch<SimulationScenario>(`/simulations/scenarios/${id}`, input),
  deleteScenario: (id: string) => apiClient.delete(`/simulations/scenarios/${id}`),
  addScenarioEvent: (id: string, input: ScenarioEventInput) => apiClient.post<ScenarioEvent, ScenarioEventInput>(`/simulations/scenarios/${id}/events`, input),
  duplicateScenarioEvent: (id: string, eventId: string) => apiClient.post<ScenarioEvent>(`/simulations/scenarios/${id}/events/${eventId}/duplicate`, {}),
  deleteScenarioEvent: (id: string, eventId: string) => apiClient.delete(`/simulations/scenarios/${id}/events/${eventId}`),
};
