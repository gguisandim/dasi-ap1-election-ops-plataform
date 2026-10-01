import { apiClient } from "@eops/api-client";
import type { ElectionSummary } from "@eops/shared/elections";
import type { FailureProbability, SimulationSummary } from "@eops/shared/simulation";
export interface SimulationInput { name: string; electionId: string; scenarioId?: string; speed: number; probability: FailureProbability; connectivity: boolean; equipment: boolean; transmission: boolean; logistics: boolean; applyToOperations: boolean; }
export const simulatorService = {
  list: () => apiClient.get<SimulationSummary[]>("/simulations"), get: (id: string) => apiClient.get<SimulationSummary>(`/simulations/${id}`),
  elections: () => apiClient.get<ElectionSummary[]>("/elections"), create: (input: SimulationInput) => apiClient.post<SimulationSummary, SimulationInput>("/simulations", input),
  start: (id: string) => apiClient.post(`/simulations/${id}/start`, {}), pause: (id: string) => apiClient.post(`/simulations/${id}/pause`, {}),
  tick: (id: string) => apiClient.post(`/simulations/${id}/tick`, {}), finish: (id: string) => apiClient.post(`/simulations/${id}/finish`, {}),
};
