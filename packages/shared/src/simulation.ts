/**
 * Contratos e regras puras do Operational Simulator (SPEC 2026-10-06, Parte 1).
 *
 * Vocabulário fechado de dimensões de score, tabela normativa de transições,
 * metadados de evento, normalização por dimensão, score composto, avaliação de
 * objetivos/critérios e validação estrutural de cenário.
 *
 * Restrição de runtime: este arquivo é executado pelo Node em modo strip-only.
 * Use apenas sintaxe apagável — `const ... as const`, `type`, `interface`,
 * `function`. Nunca `enum`, `namespace`, property parameters ou `import =`.
 */

/* ------------------------------------------------------------------ *
 * Constantes de relógio lógico e velocidade
 * ------------------------------------------------------------------ */

/** Duração lógica de um tick, em segundos simulados. */
export const TICK_SECONDS = 180;

/** Velocidades permitidas. Valor fora do conjunto é rejeitado com 400. */
export const SIMULATION_SPEEDS = [1, 2, 5, 10, 20] as const;
export type SimulationSpeed = (typeof SIMULATION_SPEEDS)[number];

export function isValidSimulationSpeed(value: unknown): value is SimulationSpeed {
  return typeof value === "number" && (SIMULATION_SPEEDS as readonly number[]).includes(value);
}

/* ------------------------------------------------------------------ *
 * Vocabulário de dimensões de score (§1.8)
 * ------------------------------------------------------------------ */

export const SIMULATION_DIMENSIONS = [
  "responseTime",
  "unresolvedIncidents",
  "deadlineMisses",
  "availability",
  "recoveryTime",
  "workforceCoverage",
  "resourceFulfillment",
  "transmission",
  "readiness",
  "accumulatedCriticality",
  "decisionQuality",
] as const;
export type SimulationDimension = (typeof SIMULATION_DIMENSIONS)[number];

/** Métricas de objetivo/critério usam exatamente este vocabulário. */
export type SimulationMetricKey = SimulationDimension;

export const SIMULATION_DIMENSION_LABELS: Record<SimulationDimension, string> = {
  responseTime: "Rapidez de resposta",
  unresolvedIncidents: "Incidentes não resolvidos",
  deadlineMisses: "Prazos perdidos",
  availability: "Disponibilidade de transmissão",
  recoveryTime: "Tempo de recuperação",
  workforceCoverage: "Cobertura de turno",
  resourceFulfillment: "Atendimento de recursos",
  transmission: "Integridade da malha",
  readiness: "Prontidão de preparação",
  accumulatedCriticality: "Criticidade acumulada",
  decisionQuality: "Qualidade das decisões",
};

/** Versão do cálculo do score: gravada para auditoria de comparações. */
export const SIMULATION_WEIGHTS_VERSION = "simulation-score/v1";

/** Alvos lógicos usados na normalização (segundos simulados). */
export const RESPONSE_TARGET_SECONDS = 1800;
export const RECOVERY_TARGET_SECONDS = 3600;

/**
 * Pesos default centralizados. Não precisam somar 100: o score composto é
 * normalizado pela soma dos pesos efetivos.
 */
export const DEFAULT_SIMULATION_WEIGHTS: Record<SimulationDimension, number> = {
  responseTime: 12,
  unresolvedIncidents: 14,
  deadlineMisses: 10,
  availability: 10,
  recoveryTime: 8,
  workforceCoverage: 8,
  resourceFulfillment: 6,
  transmission: 8,
  readiness: 6,
  accumulatedCriticality: 10,
  decisionQuality: 8,
};

/* ------------------------------------------------------------------ *
 * Status de execução (§1.3)
 * ------------------------------------------------------------------ */

/** Valores persistidos no banco (compatibilidade histórica). */
export const SIMULATION_DB_STATUSES = [
  "DRAFT",
  "RUNNING",
  "PAUSED",
  "FINISHED",
  "FAILED",
  "CANCELLED",
] as const;
export type SimulationDbStatus = (typeof SIMULATION_DB_STATUSES)[number];

/** Nomes conceituais adotados em contratos de API e na UI. */
export const SIMULATION_API_STATUSES = [
  "CREATED",
  "RUNNING",
  "PAUSED",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
] as const;
export type SimulationStatus = (typeof SIMULATION_API_STATUSES)[number];

const DB_TO_API_STATUS: Record<SimulationDbStatus, SimulationStatus> = {
  DRAFT: "CREATED",
  RUNNING: "RUNNING",
  PAUSED: "PAUSED",
  FINISHED: "COMPLETED",
  FAILED: "FAILED",
  CANCELLED: "CANCELLED",
};

const API_TO_DB_STATUS: Record<SimulationStatus, SimulationDbStatus> = {
  CREATED: "DRAFT",
  RUNNING: "RUNNING",
  PAUSED: "PAUSED",
  COMPLETED: "FINISHED",
  FAILED: "FAILED",
  CANCELLED: "CANCELLED",
};

export function toApiSimulationStatus(status: SimulationDbStatus): SimulationStatus {
  return DB_TO_API_STATUS[status];
}

export function toDbSimulationStatus(status: SimulationStatus): SimulationDbStatus {
  return API_TO_DB_STATUS[status];
}

export const SIMULATION_STATUS_LABELS: Record<SimulationStatus, string> = {
  CREATED: "Criada",
  RUNNING: "Em execução",
  PAUSED: "Pausada",
  COMPLETED: "Concluída",
  FAILED: "Falhou",
  CANCELLED: "Cancelada",
};

/** Tabela normativa de transições (§1.3). Fora dela a transição é rejeitada com 409. */
export const SIMULATION_TRANSITIONS: Record<SimulationDbStatus, readonly SimulationDbStatus[]> = {
  DRAFT: ["RUNNING", "CANCELLED"],
  RUNNING: ["PAUSED", "FINISHED", "FAILED", "CANCELLED"],
  PAUSED: ["RUNNING", "FINISHED", "FAILED", "CANCELLED"],
  FINISHED: [],
  FAILED: [],
  CANCELLED: [],
};

export const SIMULATION_TERMINAL_STATUSES: readonly SimulationDbStatus[] = [
  "FINISHED",
  "FAILED",
  "CANCELLED",
];

export function canTransitionSimulation(from: SimulationDbStatus, to: SimulationDbStatus): boolean {
  return SIMULATION_TRANSITIONS[from].includes(to);
}

export function isTerminalSimulationStatus(status: SimulationDbStatus): boolean {
  return SIMULATION_TERMINAL_STATUSES.includes(status);
}

/* ------------------------------------------------------------------ *
 * Cenário: status, alvos e eventos (§1.5, §1.6)
 * ------------------------------------------------------------------ */

export const SCENARIO_STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;
export type SimulationScenarioStatus = (typeof SCENARIO_STATUSES)[number];

export const SCENARIO_STATUS_LABELS: Record<SimulationScenarioStatus, string> = {
  DRAFT: "Rascunho",
  PUBLISHED: "Publicado",
  ARCHIVED: "Arquivado",
};

/** Cenário publicado aceita só clonagem/arquivamento; arquivado é terminal. */
export function canEditScenario(status: SimulationScenarioStatus): boolean {
  return status === "DRAFT";
}

export function canExecuteScenario(status: SimulationScenarioStatus, isTemplate: boolean): boolean {
  return status !== "ARCHIVED" && !isTemplate;
}

export const SIMULATION_TARGET_TYPES = [
  "NONE",
  "POLLING_PLACE",
  "ZONE",
  "ASSET",
  "TRANSMISSION",
] as const;
export type SimulationTargetType = (typeof SIMULATION_TARGET_TYPES)[number];

export const SIMULATION_EVENT_TYPES = [
  "INCIDENT_CREATE",
  "INCIDENT_CRITICAL",
  "TRANSMISSION_FAILURE",
  "TRANSMISSION_RECOVERY",
  "TRANSMISSION_DEGRADATION",
  "CONNECTIVITY_LOSS",
  "ASSET_FAILURE",
  "ASSET_RECOVERY",
  "OPERATIONAL_DELAY",
  "TEAM_UNAVAILABLE",
  "OPERATOR_ABSENCE",
  "VEHICLE_UNAVAILABLE",
  "ROUTE_FAILURE",
  "RESOURCE_REQUEST_CREATE",
  "PREPARATION_BLOCKER",
  "HANDOVER_PENDING",
  "WORKFORCE_SHORTAGE",
  "SERVICE_RECOVERY",
] as const;
export type SimulationEventType = (typeof SIMULATION_EVENT_TYPES)[number];

export type SimulationEventDomain =
  | "INCIDENT"
  | "ASSET"
  | "TRANSMISSION"
  | "WORKFORCE"
  | "LOGISTICS"
  | "RESOURCE_REQUEST"
  | "PREPARATION"
  | "HANDOVER"
  | "NONE";

export interface SimulationEventTypeMetadata {
  label: string;
  /** Tipos de alvo aceitos. Vazio significa "não exige alvo". */
  targetTypes: readonly SimulationTargetType[];
  requiresTarget: boolean;
  /** Cria Incident real marcado como simulado. */
  createsSimulatedIncident: boolean;
  /** Só altera domínio externo quando applyToOperations = true (Asset). */
  writesExternalWhenApplied: boolean;
  externalDomain: SimulationEventDomain;
}

const NO_TARGET: readonly SimulationTargetType[] = [];

/**
 * Efeitos por tipo e limite de escrita cross-domain (§1.6). Os limites são
 * normativos: nenhum tipo fora de INCIDENT_* e ASSET_* escreve em domínio real.
 */
export const SIMULATION_EVENT_METADATA: Record<SimulationEventType, SimulationEventTypeMetadata> = {
  INCIDENT_CREATE: { label: "Criar incidente", targetTypes: ["POLLING_PLACE", "ZONE", "ASSET"], requiresTarget: true, createsSimulatedIncident: true, writesExternalWhenApplied: false, externalDomain: "INCIDENT" },
  INCIDENT_CRITICAL: { label: "Incidente crítico", targetTypes: ["POLLING_PLACE", "ZONE", "ASSET"], requiresTarget: true, createsSimulatedIncident: true, writesExternalWhenApplied: false, externalDomain: "INCIDENT" },
  TRANSMISSION_FAILURE: { label: "Falha de transmissão", targetTypes: ["TRANSMISSION"], requiresTarget: true, createsSimulatedIncident: false, writesExternalWhenApplied: false, externalDomain: "TRANSMISSION" },
  TRANSMISSION_RECOVERY: { label: "Recuperação de transmissão", targetTypes: ["TRANSMISSION"], requiresTarget: true, createsSimulatedIncident: false, writesExternalWhenApplied: false, externalDomain: "TRANSMISSION" },
  TRANSMISSION_DEGRADATION: { label: "Degradação de transmissão", targetTypes: ["TRANSMISSION"], requiresTarget: true, createsSimulatedIncident: false, writesExternalWhenApplied: false, externalDomain: "TRANSMISSION" },
  CONNECTIVITY_LOSS: { label: "Perda de conectividade", targetTypes: ["TRANSMISSION"], requiresTarget: true, createsSimulatedIncident: false, writesExternalWhenApplied: false, externalDomain: "TRANSMISSION" },
  ASSET_FAILURE: { label: "Falha de ativo", targetTypes: ["ASSET"], requiresTarget: true, createsSimulatedIncident: false, writesExternalWhenApplied: true, externalDomain: "ASSET" },
  ASSET_RECOVERY: { label: "Recuperação de ativo", targetTypes: ["ASSET"], requiresTarget: true, createsSimulatedIncident: false, writesExternalWhenApplied: true, externalDomain: "ASSET" },
  OPERATIONAL_DELAY: { label: "Atraso operacional", targetTypes: NO_TARGET, requiresTarget: false, createsSimulatedIncident: false, writesExternalWhenApplied: false, externalDomain: "NONE" },
  TEAM_UNAVAILABLE: { label: "Equipe indisponível", targetTypes: ["ZONE", "POLLING_PLACE"], requiresTarget: false, createsSimulatedIncident: false, writesExternalWhenApplied: false, externalDomain: "WORKFORCE" },
  OPERATOR_ABSENCE: { label: "Ausência de operador", targetTypes: ["ZONE", "POLLING_PLACE"], requiresTarget: false, createsSimulatedIncident: false, writesExternalWhenApplied: false, externalDomain: "WORKFORCE" },
  VEHICLE_UNAVAILABLE: { label: "Veículo indisponível", targetTypes: NO_TARGET, requiresTarget: false, createsSimulatedIncident: false, writesExternalWhenApplied: false, externalDomain: "LOGISTICS" },
  ROUTE_FAILURE: { label: "Falha de rota", targetTypes: ["ZONE"], requiresTarget: false, createsSimulatedIncident: false, writesExternalWhenApplied: false, externalDomain: "LOGISTICS" },
  RESOURCE_REQUEST_CREATE: { label: "Solicitação de recurso", targetTypes: ["POLLING_PLACE", "ZONE"], requiresTarget: false, createsSimulatedIncident: false, writesExternalWhenApplied: false, externalDomain: "RESOURCE_REQUEST" },
  PREPARATION_BLOCKER: { label: "Bloqueio de preparação", targetTypes: ["POLLING_PLACE", "ZONE"], requiresTarget: false, createsSimulatedIncident: false, writesExternalWhenApplied: false, externalDomain: "PREPARATION" },
  HANDOVER_PENDING: { label: "Passagem de turno pendente", targetTypes: ["ZONE", "POLLING_PLACE"], requiresTarget: false, createsSimulatedIncident: false, writesExternalWhenApplied: false, externalDomain: "HANDOVER" },
  WORKFORCE_SHORTAGE: { label: "Insuficiência de turno", targetTypes: ["ZONE", "POLLING_PLACE"], requiresTarget: false, createsSimulatedIncident: false, writesExternalWhenApplied: false, externalDomain: "WORKFORCE" },
  SERVICE_RECOVERY: { label: "Recuperação de serviço", targetTypes: NO_TARGET, requiresTarget: false, createsSimulatedIncident: false, writesExternalWhenApplied: false, externalDomain: "NONE" },
};

export const SIMULATION_EVENT_TYPE_LABELS: Record<SimulationEventType, string> = Object.fromEntries(
  SIMULATION_EVENT_TYPES.map((type) => [type, SIMULATION_EVENT_METADATA[type].label]),
) as Record<SimulationEventType, string>;

export function isSimulationEventType(value: unknown): value is SimulationEventType {
  return typeof value === "string" && (SIMULATION_EVENT_TYPES as readonly string[]).includes(value);
}

/** Tipos que nunca escrevem fora de Incident/Asset — usados nos testes de limite. */
export const SIMULATION_READ_ONLY_EVENT_TYPES: readonly SimulationEventType[] = SIMULATION_EVENT_TYPES.filter(
  (type) => !SIMULATION_EVENT_METADATA[type].createsSimulatedIncident && !SIMULATION_EVENT_METADATA[type].writesExternalWhenApplied,
);

export const SIMULATION_HEALTH_LEVELS = ["NORMAL", "ATTENTION", "CRITICAL"] as const;
export type SimulationHealth = (typeof SIMULATION_HEALTH_LEVELS)[number];

export const SIMULATION_DECISION_KINDS = [
  "ESCALATE",
  "DISPATCH_TEAM",
  "ACTIVATE_FAILOVER",
  "REQUEST_RESOURCE",
  "RECLASSIFY_SEVERITY",
  "ACCEPT_DEGRADATION",
  "ABORT_OPERATION",
] as const;
export type SimulationDecisionKind = (typeof SIMULATION_DECISION_KINDS)[number];

export const SIMULATION_DECISION_KIND_LABELS: Record<SimulationDecisionKind, string> = {
  ESCALATE: "Escalar",
  DISPATCH_TEAM: "Despachar equipe",
  ACTIVATE_FAILOVER: "Ativar failover",
  REQUEST_RESOURCE: "Solicitar recurso",
  RECLASSIFY_SEVERITY: "Reclassificar severidade",
  ACCEPT_DEGRADATION: "Aceitar degradação",
  ABORT_OPERATION: "Abortar operação",
};

/* ------------------------------------------------------------------ *
 * Entradas e cálculo do score (§1.8)
 * ------------------------------------------------------------------ */

/**
 * Estado bruto do run, derivado no servidor de eventos, incidentes e decisões.
 * Toda normalização parte daqui — nenhuma decisão depende de relógio de parede.
 */
export interface SimulationScoreInput {
  plannedEvents: number;
  appliedEvents: number;
  incidentsCreated: number;
  incidentsResolved: number;
  incidentsUnresolved: number;
  incidentsWithDeadline: number;
  deadlineMisses: number;
  respondedIncidents: number;
  meanResponseSeconds: number | null;
  transmissionObservations: number;
  transmissionFailures: number;
  transmissionRecoveries: number;
  recoverySamples: number;
  meanRecoverySeconds: number | null;
  workforceObservations: number;
  workforceShortages: number;
  resourceRequestsCreated: number;
  resourceRequestsFulfilled: number;
  preparationObservations: number;
  preparationBlockers: number;
  criticalEventsApplied: number;
  criticalEventsHandled: number;
  decisionOpportunities: number;
  decisionsRecorded: number;
}

export interface SimulationScoreCounters {
  plannedEvents: number;
  appliedEvents: number;
  incidentsCreated: number;
  incidentsResolved: number;
  incidentsUnresolved: number;
  deadlineMisses: number;
  transmissionFailures: number;
  transmissionRecoveries: number;
  workforceShortages: number;
  resourceRequestsCreated: number;
  resourceRequestsFulfilled: number;
  preparationBlockers: number;
  criticalEventsApplied: number;
  decisionsRecorded: number;
}

export interface SimulationScoreBreakdown {
  dimensions: Record<SimulationDimension, number>;
  weights: Record<SimulationDimension, number>;
  weightsVersion: string;
  counters: SimulationScoreCounters;
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

/** Fração de "eventos ruins" sobre observações; sem observação, pontua cheio. */
export function ratioScore(bad: number, total: number, emptyScore = 100): number {
  if (total <= 0) return clampScore(emptyScore);
  return clampScore(100 * (1 - bad / total));
}

/** Normalização inversa contra um alvo: no alvo ≈ 50, no dobro do alvo = 0. */
export function inverseTargetScore(actual: number, target: number): number {
  if (target <= 0) return 100;
  return clampScore(100 * (1 - actual / (2 * target)));
}

/**
 * Normaliza cada dimensão em 0..100 com fórmula explícita. Pura e testável.
 */
export function computeSimulationDimensions(
  input: SimulationScoreInput,
): Record<SimulationDimension, number> {
  const response =
    input.incidentsCreated === 0
      ? 100
      : input.meanResponseSeconds === null
        ? 0
        : inverseTargetScore(input.meanResponseSeconds, RESPONSE_TARGET_SECONDS);
  const recovery =
    input.transmissionFailures === 0
      ? 100
      : input.meanRecoverySeconds === null
        ? 0
        : inverseTargetScore(input.meanRecoverySeconds, RECOVERY_TARGET_SECONDS);
  const fulfillment =
    input.resourceRequestsCreated === 0
      ? 100
      : clampScore(100 * (input.resourceRequestsFulfilled / input.resourceRequestsCreated));
  const transmissionIntegrity =
    input.transmissionFailures === 0
      ? 100
      : clampScore(100 * Math.min(1, input.transmissionRecoveries / input.transmissionFailures));
  const decisionQuality =
    input.decisionOpportunities === 0
      ? 100
      : clampScore(100 * Math.min(1, input.decisionsRecorded / input.decisionOpportunities));
  return {
    responseTime: response,
    unresolvedIncidents: ratioScore(input.incidentsUnresolved, input.incidentsCreated),
    deadlineMisses: ratioScore(input.deadlineMisses, input.incidentsWithDeadline),
    availability: ratioScore(input.transmissionFailures, input.transmissionObservations),
    recoveryTime: recovery,
    workforceCoverage: ratioScore(input.workforceShortages, input.workforceObservations),
    resourceFulfillment: fulfillment,
    transmission: transmissionIntegrity,
    readiness: ratioScore(input.preparationBlockers, input.preparationObservations),
    accumulatedCriticality: ratioScore(
      Math.max(0, input.criticalEventsApplied - input.criticalEventsHandled),
      input.criticalEventsApplied,
    ),
    decisionQuality,
  };
}

/** Mescla pesos fornecidos pelo cenário sobre os defaults, ignorando chaves desconhecidas. */
export function resolveSimulationWeights(
  overrides?: Record<string, number> | null,
): Record<SimulationDimension, number> {
  const weights: Record<SimulationDimension, number> = { ...DEFAULT_SIMULATION_WEIGHTS };
  if (!overrides) return weights;
  for (const dimension of SIMULATION_DIMENSIONS) {
    const value = overrides[dimension];
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) weights[dimension] = value;
  }
  return weights;
}

/** score = Σ(w_i × d_i) / Σ(w_i). */
export function calculateCompositeScore(
  dimensions: Record<SimulationDimension, number>,
  weights: Record<SimulationDimension, number>,
): number {
  const totalWeight = SIMULATION_DIMENSIONS.reduce((sum, key) => sum + weights[key], 0);
  if (totalWeight <= 0) return 0;
  const weighted = SIMULATION_DIMENSIONS.reduce((sum, key) => sum + weights[key] * dimensions[key], 0);
  return clampScore(weighted / totalWeight);
}

export function buildSimulationBreakdown(
  input: SimulationScoreInput,
  scoreWeights?: Record<string, number> | null,
): SimulationScoreBreakdown {
  const dimensions = computeSimulationDimensions(input);
  const weights = resolveSimulationWeights(scoreWeights);
  return {
    dimensions,
    weights,
    weightsVersion: SIMULATION_WEIGHTS_VERSION,
    counters: buildScoreCounters(input),
  };
}

export function buildScoreCounters(input: SimulationScoreInput): SimulationScoreCounters {
  return {
    plannedEvents: input.plannedEvents,
    appliedEvents: input.appliedEvents,
    incidentsCreated: input.incidentsCreated,
    incidentsResolved: input.incidentsResolved,
    incidentsUnresolved: input.incidentsUnresolved,
    deadlineMisses: input.deadlineMisses,
    transmissionFailures: input.transmissionFailures,
    transmissionRecoveries: input.transmissionRecoveries,
    workforceShortages: input.workforceShortages,
    resourceRequestsCreated: input.resourceRequestsCreated,
    resourceRequestsFulfilled: input.resourceRequestsFulfilled,
    preparationBlockers: input.preparationBlockers,
    criticalEventsApplied: input.criticalEventsApplied,
    decisionsRecorded: input.decisionsRecorded,
  };
}

/** Saúde simulada no vocabulário do Command Center (§1.7). */
export function deriveSimulationHealth(input: SimulationScoreInput): SimulationHealth {
  if (input.incidentsUnresolved > 0 || input.criticalEventsApplied > input.criticalEventsHandled) return "CRITICAL";
  if (
    input.deadlineMisses > 0 ||
    input.workforceShortages > 0 ||
    input.transmissionFailures > input.transmissionRecoveries ||
    input.preparationBlockers > 0
  )
    return "ATTENTION";
  return "NORMAL";
}

/* ------------------------------------------------------------------ *
 * Objetivos e critérios (§1.5, §1.8)
 * ------------------------------------------------------------------ */

export type SimulationObjectiveDirection = "AT_LEAST" | "AT_MOST";
export type SimulationCriterionOperator = "GTE" | "LTE";

export interface SimulationObjective {
  key: SimulationMetricKey;
  label: string;
  target: number;
  direction: SimulationObjectiveDirection;
  weight: number;
}

export interface SimulationCriterion {
  metric: SimulationMetricKey;
  operator: SimulationCriterionOperator;
  value: number;
  label: string;
}

export interface SimulationObjectiveResult {
  key: SimulationMetricKey;
  label: string;
  target: number;
  actual: number;
  direction: SimulationObjectiveDirection;
  weight: number;
  met: boolean;
}

export interface SimulationCriterionResult {
  metric: SimulationMetricKey;
  operator: SimulationCriterionOperator;
  value: number;
  label: string;
  actual: number;
  triggered: boolean;
}

export interface SimulationOutcome {
  objectiveResults: SimulationObjectiveResult[];
  successEvaluated: boolean;
  failureTriggered: boolean;
  failureReasons: string[];
}

export function evaluateObjectives(
  objectives: readonly SimulationObjective[] | null | undefined,
  dimensions: Record<SimulationDimension, number>,
): SimulationObjectiveResult[] {
  return (objectives ?? []).map((objective) => {
    const actual = dimensions[objective.key];
    const met = objective.direction === "AT_LEAST" ? actual >= objective.target : actual <= objective.target;
    return { key: objective.key, label: objective.label, target: objective.target, actual, direction: objective.direction, weight: objective.weight, met };
  });
}

export function evaluateCriteria(
  criteria: readonly SimulationCriterion[] | null | undefined,
  dimensions: Record<SimulationDimension, number>,
): SimulationCriterionResult[] {
  return (criteria ?? []).map((criterion) => {
    const actual = dimensions[criterion.metric];
    const triggered = criterion.operator === "GTE" ? actual >= criterion.value : actual <= criterion.value;
    return { metric: criterion.metric, operator: criterion.operator, value: criterion.value, label: criterion.label, actual, triggered };
  });
}

export function evaluateSimulationOutcome(args: {
  objectives?: readonly SimulationObjective[] | null;
  successCriteria?: readonly SimulationCriterion[] | null;
  failureCriteria?: readonly SimulationCriterion[] | null;
  dimensions: Record<SimulationDimension, number>;
}): SimulationOutcome {
  const objectiveResults = evaluateObjectives(args.objectives, args.dimensions);
  const successFromCriteria = evaluateCriteria(args.successCriteria, args.dimensions);
  const failureFromCriteria = evaluateCriteria(args.failureCriteria, args.dimensions);
  const objectivesMet = objectiveResults.every((result) => result.met);
  const successFromObjectives = (args.objectives ?? []).length === 0 ? true : objectivesMet;
  const successEvaluated = successFromCriteria.every((result) => result.triggered) && successFromObjectives;
  const failures = failureFromCriteria.filter((result) => result.triggered);
  const failureReasons = failures.map((result) => `${result.label}: ${result.metric} ${result.operator} ${result.value} (atual ${result.actual}).`);
  for (const objective of objectiveResults) {
    if (!objective.met) failureReasons.push(`Objetivo não atingido: ${objective.label} (alvo ${objective.target}, atual ${objective.actual}).`);
  }
  return {
    objectiveResults,
    successEvaluated,
    failureTriggered: failures.length > 0,
    failureReasons,
  };
}

/* ------------------------------------------------------------------ *
 * Validação estrutural (§1.5)
 * ------------------------------------------------------------------ */

export function validateScoreWeights(value: unknown): string[] {
  if (value === null || value === undefined) return [];
  if (typeof value !== "object" || Array.isArray(value)) return ["scoreWeights deve ser um objeto de pesos por dimensão."];
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) return ["scoreWeights não pode ser vazio."];
  const errors: string[] = [];
  let sum = 0;
  for (const [key, weight] of entries) {
    if (!(SIMULATION_DIMENSIONS as readonly string[]).includes(key)) {
      errors.push(`Dimensão de score desconhecida: ${key}.`);
      continue;
    }
    if (typeof weight !== "number" || !Number.isFinite(weight) || weight < 0) {
      errors.push(`O peso de ${key} deve ser um número maior ou igual a zero.`);
      continue;
    }
    sum += weight;
  }
  if (errors.length === 0 && sum <= 0) errors.push("A soma dos pesos não pode ser zero.");
  return errors;
}

export function validateObjectives(value: unknown): string[] {
  if (value === null || value === undefined) return [];
  if (!Array.isArray(value)) return ["objectives deve ser uma lista."];
  const errors: string[] = [];
  value.forEach((entry, index) => {
    const label = `Objetivo ${index + 1}`;
    if (!entry || typeof entry !== "object") {
      errors.push(`${label}: estrutura inválida.`);
      return;
    }
    const objective = entry as Record<string, unknown>;
    if (!(SIMULATION_DIMENSIONS as readonly string[]).includes(String(objective.key))) errors.push(`${label}: métrica desconhecida (${String(objective.key)}).`);
    if (typeof objective.label !== "string" || !objective.label.trim()) errors.push(`${label}: informe um rótulo.`);
    if (typeof objective.target !== "number" || !Number.isFinite(objective.target)) errors.push(`${label}: o alvo deve ser numérico.`);
    if (objective.direction !== "AT_LEAST" && objective.direction !== "AT_MOST") errors.push(`${label}: direção deve ser AT_LEAST ou AT_MOST.`);
    if (typeof objective.weight !== "number" || !Number.isFinite(objective.weight) || objective.weight < 0) errors.push(`${label}: o peso deve ser maior ou igual a zero.`);
  });
  return errors;
}

export function validateCriteria(value: unknown, field: string): string[] {
  if (value === null || value === undefined) return [];
  if (!Array.isArray(value)) return [`${field} deve ser uma lista.`];
  const errors: string[] = [];
  value.forEach((entry, index) => {
    const label = `${field} ${index + 1}`;
    if (!entry || typeof entry !== "object") {
      errors.push(`${label}: estrutura inválida.`);
      return;
    }
    const criterion = entry as Record<string, unknown>;
    if (!(SIMULATION_DIMENSIONS as readonly string[]).includes(String(criterion.metric))) errors.push(`${label}: métrica desconhecida (${String(criterion.metric)}).`);
    if (criterion.operator !== "GTE" && criterion.operator !== "LTE") errors.push(`${label}: operador deve ser GTE ou LTE.`);
    if (typeof criterion.value !== "number" || !Number.isFinite(criterion.value)) errors.push(`${label}: o valor deve ser numérico.`);
    if (typeof criterion.label !== "string" || !criterion.label.trim()) errors.push(`${label}: informe um rótulo.`);
  });
  return errors;
}

export function validateInitialConditions(value: unknown): string[] {
  if (value === null || value === undefined) return [];
  if (typeof value !== "object" || Array.isArray(value)) return ["initialConditions deve ser um objeto."];
  const errors: string[] = [];
  const conditions = value as Record<string, unknown>;
  if (conditions.zones !== undefined) {
    if (!Array.isArray(conditions.zones) || conditions.zones.some((zone) => typeof zone !== "string")) errors.push("initialConditions.zones deve ser uma lista de identificadores.");
  }
  if (conditions.coverages !== undefined) {
    if (typeof conditions.coverages !== "object" || Array.isArray(conditions.coverages)) errors.push("initialConditions.coverages deve ser um objeto.");
    else {
      const coverages = conditions.coverages as Record<string, unknown>;
      for (const key of ["shiftCoveragePercent", "transmissionOnlineTarget"]) {
        if (coverages[key] !== undefined && (typeof coverages[key] !== "number" || !Number.isFinite(coverages[key] as number))) errors.push(`initialConditions.coverages.${key} deve ser numérico.`);
      }
    }
  }
  if (conditions.flags !== undefined) {
    if (typeof conditions.flags !== "object" || Array.isArray(conditions.flags)) errors.push("initialConditions.flags deve ser um objeto.");
    else {
      const flags = conditions.flags as Record<string, unknown>;
      for (const key of ["degradedStart", "noBackupCircuit"]) {
        if (flags[key] !== undefined && typeof flags[key] !== "boolean") errors.push(`initialConditions.flags.${key} deve ser booleano.`);
      }
    }
  }
  return errors;
}

/** Valida a coerência de alvo de um evento contra os metadados do tipo. */
export function validateEventTarget(
  type: SimulationEventType,
  targetType: SimulationTargetType | null | undefined,
  targetId: string | null | undefined,
): string[] {
  const metadata = SIMULATION_EVENT_METADATA[type];
  const errors: string[] = [];
  const resolvedTarget = targetType ?? "NONE";
  if (metadata.requiresTarget) {
    if (resolvedTarget === "NONE") errors.push(`informe o tipo de alvo para ${type}.`);
    else if (!metadata.targetTypes.includes(resolvedTarget)) errors.push(`${type} exige alvo ${metadata.targetTypes.join(" ou ")}.`);
    if (!targetId) errors.push(`${type} exige targetId.`);
  } else if (resolvedTarget !== "NONE" && metadata.targetTypes.length > 0 && !metadata.targetTypes.includes(resolvedTarget)) {
    errors.push(`O alvo ${resolvedTarget} não é aceito por ${type}.`);
  }
  return errors;
}

/* ------------------------------------------------------------------ *
 * Comparação de runs (§1.10)
 * ------------------------------------------------------------------ */

export type SimulationComparisonValue = number | null;

export interface SimulationRunComparison {
  id: string;
  name: string;
  status: SimulationStatus;
  score: number | null;
  seed: number | null;
  electionId: string;
  dimensions: Record<SimulationDimension, SimulationComparisonValue>;
  counters: Partial<SimulationScoreCounters> | null;
}

export interface SimulationComparison {
  dimensions: readonly SimulationDimension[];
  runs: SimulationRunComparison[];
  seedMismatch: boolean;
  missingDimensions: boolean;
}

/**
 * Compara runs do mesmo pleito. Dimensão ausente em uma run vira `null`, nunca 0.
 * A validação de pleito é responsabilidade do chamador (erro 400).
 */
export function compareSimulationRuns(
  runs: ReadonlyArray<{
    id: string;
    name: string;
    status: SimulationStatus;
    score: number | null;
    seed: number | null;
    electionId: string;
    breakdown: SimulationScoreBreakdown | null;
  }>,
): SimulationComparison {
  const seeds = new Set(runs.map((run) => run.seed).filter((seed): seed is number => seed !== null));
  let missingDimensions = false;
  const compared = runs.map((run) => {
    const dimensions = {} as Record<SimulationDimension, SimulationComparisonValue>;
    for (const dimension of SIMULATION_DIMENSIONS) {
      const value = run.breakdown?.dimensions?.[dimension];
      if (typeof value === "number") dimensions[dimension] = value;
      else {
        dimensions[dimension] = null;
        missingDimensions = true;
      }
    }
    return {
      id: run.id,
      name: run.name,
      status: run.status,
      score: run.score,
      seed: run.seed,
      electionId: run.electionId,
      dimensions,
      counters: run.breakdown?.counters ?? null,
    };
  });
  return {
    dimensions: SIMULATION_DIMENSIONS,
    runs: compared,
    seedMismatch: seeds.size > 1,
    missingDimensions,
  };
}
