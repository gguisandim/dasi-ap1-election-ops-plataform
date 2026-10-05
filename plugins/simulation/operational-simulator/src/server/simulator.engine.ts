import { IncidentSeverity, IncidentStatus, SimulationScenarioEventType, SimulationTargetType } from "@prisma/client";

/** Duração lógica de um tick, em segundos simulados. */
export const TICK_SECONDS = 180;

export const ACTIVE_INCIDENT_STATUSES: IncidentStatus[] = [IncidentStatus.NEW, IncidentStatus.TRIAGED, IncidentStatus.ASSIGNED, IncidentStatus.IN_PROGRESS];

const TARGET_REQUIRED_TYPES: SimulationScenarioEventType[] = [
  SimulationScenarioEventType.INCIDENT_CREATE,
  SimulationScenarioEventType.ASSET_FAILURE,
  SimulationScenarioEventType.ASSET_RECOVERY,
  SimulationScenarioEventType.TRANSMISSION_FAILURE,
  SimulationScenarioEventType.TRANSMISSION_RECOVERY,
];

export interface ScenarioEventInput {
  offsetSeconds: number;
  type: SimulationScenarioEventType;
  severity?: IncidentSeverity | null;
  targetType?: SimulationTargetType | null;
  targetId?: string | null;
  probability: number;
  payload?: unknown;
}

/**
 * PRNG determinístico (mulberry32). Com seed, a mesma seed produz a mesma
 * sequência; sem seed, delega para `Math.random` (não determinístico).
 */
export function createRng(seed?: number | null): () => number {
  if (seed === null || seed === undefined) return Math.random;
  let state = (seed >>> 0) || 1;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Valida os eventos de um cenário; retorna mensagens em português (vazio = ok). */
export function validateScenarioEvents(events: ScenarioEventInput[]): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  events.forEach((event, index) => {
    const label = `Evento ${index + 1}`;
    if (!Number.isInteger(event.offsetSeconds) || event.offsetSeconds < 0) errors.push(`${label}: o deslocamento deve ser um inteiro maior ou igual a zero.`);
    if (!Number.isInteger(event.probability) || event.probability < 0 || event.probability > 100) errors.push(`${label}: a probabilidade deve estar entre 0 e 100.`);
    const key = `${event.offsetSeconds}:${event.type}`;
    if (seen.has(key)) errors.push(`${label}: já existe um evento ${event.type} em ${event.offsetSeconds}s.`);
    seen.add(key);
    const targetType = event.targetType ?? SimulationTargetType.NONE;
    if (TARGET_REQUIRED_TYPES.includes(event.type) && targetType === SimulationTargetType.NONE) errors.push(`${label}: informe o tipo de alvo para ${event.type}.`);
  });
  return errors;
}

/** Eventos cujo offset lógico já foi alcançado e que ainda não executaram. */
export function pendingScenarioEvents<T extends { id: string; offsetSeconds: number }>(events: T[], elapsedSeconds: number, executedIds: Set<string>): T[] {
  return events
    .filter((event) => event.offsetSeconds <= elapsedSeconds && !executedIds.has(event.id))
    .sort((a, b) => a.offsetSeconds - b.offsetSeconds || a.id.localeCompare(b.id));
}

export interface SimulationEventLike {
  eventType: string;
  result: string | null;
  offsetSeconds: number;
  payload?: unknown;
}

export interface IncidentLike {
  severity: IncidentSeverity;
  status: IncidentStatus;
  slaDeadline: Date | string | null;
  resolvedAt: Date | string | null;
}

export interface ScoreInput {
  plannedEvents: number;
  executedEvents: number;
  failedEvents: number;
  slaViolations: number;
  unresolvedCritical: number;
  unrecoveredFailures: number;
}

export interface ScoreResult {
  score: number;
  coverage: number;
  skillScore: number;
  penalties: number;
}

/** Fórmula explícita do score (§5.9 da SPEC). Pura e testável. */
export function calculateScore(input: ScoreInput): ScoreResult {
  const coverage = input.plannedEvents > 0 ? Math.round((input.executedEvents / input.plannedEvents) * 100) : 100;
  const penalties = input.slaViolations * 10 + input.unresolvedCritical * 15 + input.failedEvents * 5 + input.unrecoveredFailures * 8;
  const skillScore = Math.min(100, Math.max(0, 100 - penalties));
  const score = Math.round(skillScore * 0.7 + coverage * 0.3);
  return { score, coverage, skillScore, penalties };
}

function targetOf(event: SimulationEventLike): string {
  const payload = event.payload as { targetId?: unknown } | null;
  return typeof payload?.targetId === "string" ? payload.targetId : "";
}

/** TRANSMISSION_FAILURE sem TRANSMISSION_RECOVERY posterior para o mesmo alvo. */
export function countUnrecoveredTransmissionFailures(events: SimulationEventLike[]): number {
  const failures = events.filter((event) => event.eventType === SimulationScenarioEventType.TRANSMISSION_FAILURE);
  const recoveries = events.filter((event) => event.eventType === SimulationScenarioEventType.TRANSMISSION_RECOVERY);
  return failures.filter((failure) => !recoveries.some((recovery) => targetOf(recovery) === targetOf(failure) && recovery.offsetSeconds >= failure.offsetSeconds)).length;
}

/** Tempo médio (em segundos lógicos) entre falha e recuperação de transmissão. */
export function averageRecoverySeconds(events: SimulationEventLike[]): number {
  const recoveries = events.filter((event) => event.eventType === SimulationScenarioEventType.TRANSMISSION_RECOVERY);
  const diffs = recoveries
    .map((recovery) => {
      const previous = events
        .filter((event) => event.eventType === SimulationScenarioEventType.TRANSMISSION_FAILURE && targetOf(event) === targetOf(recovery) && event.offsetSeconds <= recovery.offsetSeconds)
        .reduce<SimulationEventLike | null>((latest, event) => (!latest || event.offsetSeconds > latest.offsetSeconds ? event : latest), null);
      return previous ? recovery.offsetSeconds - previous.offsetSeconds : null;
    })
    .filter((value): value is number => value !== null);
  return diffs.length ? Math.round(diffs.reduce((total, value) => total + value, 0) / diffs.length) : 0;
}

/** Deriva as entradas da fórmula de score a partir do estado persistido. */
export function buildScoreInput(args: {
  scenarioEvents?: { offsetSeconds: number }[] | null;
  events: SimulationEventLike[];
  incidents: IncidentLike[];
  elapsedSeconds: number;
}): ScoreInput {
  const scenarioEvents = args.scenarioEvents ?? [];
  return {
    plannedEvents: scenarioEvents.filter((event) => event.offsetSeconds <= args.elapsedSeconds).length,
    executedEvents: args.events.filter((event) => event.result === "APPLIED").length,
    failedEvents: args.events.filter((event) => event.result === "FAILED").length,
    slaViolations: args.incidents.filter((incident) => incident.resolvedAt && incident.slaDeadline && new Date(incident.resolvedAt) > new Date(incident.slaDeadline)).length,
    unresolvedCritical: args.incidents.filter((incident) => incident.severity === IncidentSeverity.CRITICAL && ACTIVE_INCIDENT_STATUSES.includes(incident.status)).length,
    unrecoveredFailures: countUnrecoveredTransmissionFailures(args.events),
  };
}
