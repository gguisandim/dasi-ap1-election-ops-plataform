import { IncidentSeverity, IncidentStatus } from "@prisma/client";
import {
  SIMULATION_EVENT_METADATA,
  validateEventTarget,
  type SimulationEventType,
  type SimulationScoreInput,
  type SimulationTargetType,
} from "@eops/shared/simulation";

export { TICK_SECONDS } from "@eops/shared/simulation";

export const ACTIVE_INCIDENT_STATUSES: IncidentStatus[] = [IncidentStatus.NEW, IncidentStatus.TRIAGED, IncidentStatus.ASSIGNED, IncidentStatus.IN_PROGRESS];

const TRANSMISSION_FAILURE_TYPES: SimulationEventType[] = ["TRANSMISSION_FAILURE", "TRANSMISSION_DEGRADATION", "CONNECTIVITY_LOSS"];
const TRANSMISSION_RECOVERY_TYPES: SimulationEventType[] = ["TRANSMISSION_RECOVERY", "SERVICE_RECOVERY"];
const WORKFORCE_TYPES: SimulationEventType[] = ["OPERATOR_ABSENCE", "TEAM_UNAVAILABLE", "WORKFORCE_SHORTAGE", "HANDOVER_PENDING", "OPERATIONAL_DELAY"];
const WORKFORCE_SHORTAGE_TYPES: SimulationEventType[] = ["WORKFORCE_SHORTAGE", "OPERATOR_ABSENCE", "TEAM_UNAVAILABLE"];
const PREPARATION_TYPES: SimulationEventType[] = ["PREPARATION_BLOCKER", "HANDOVER_PENDING", "SERVICE_RECOVERY"];
const INCIDENT_TYPES: SimulationEventType[] = ["INCIDENT_CREATE", "INCIDENT_CRITICAL"];

export interface ScenarioEventInput {
  offsetSeconds: number;
  type: SimulationEventType;
  severity?: IncidentSeverity | null;
  targetType?: SimulationTargetType | null;
  targetId?: string | null;
  probability: number;
  enabled?: boolean | null;
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

/**
 * RNG de um tick: semeado por `seed + offsetSeconds` (§1.4). Nunca usa relógio
 * de parede, portanto a mesma sequência de ticks é reproduzível.
 */
export function createTickRng(seed: number | null, elapsedSeconds: number): () => number {
  return createRng(seed === null ? null : seed + elapsedSeconds);
}

/**
 * Valida os eventos de um cenário. Retorna mensagens em português (vazio = ok).
 * `durationSeconds` restringe o offset máximo quando definido.
 */
export function validateScenarioEvents(events: ScenarioEventInput[], durationSeconds?: number | null): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  events.forEach((event, index) => {
    const label = `Evento ${index + 1}`;
    if (!Number.isInteger(event.offsetSeconds) || event.offsetSeconds < 0) errors.push(`${label}: o deslocamento deve ser um inteiro maior ou igual a zero.`);
    if (typeof durationSeconds === "number" && event.offsetSeconds > durationSeconds) errors.push(`${label}: o deslocamento excede a duração do cenário (${durationSeconds}s).`);
    if (!Number.isInteger(event.probability) || event.probability < 0 || event.probability > 100) errors.push(`${label}: a probabilidade deve estar entre 0 e 100.`);
    const key = `${event.offsetSeconds}:${event.type}`;
    if (seen.has(key)) errors.push(`${label}: já existe um evento ${event.type} em ${event.offsetSeconds}s.`);
    seen.add(key);
    if (!(event.type in SIMULATION_EVENT_METADATA)) errors.push(`${label}: tipo de evento desconhecido (${event.type}).`);
    else errors.push(...validateEventTarget(event.type, event.targetType, event.targetId).map((message) => `${label}: ${message}`));
  });
  return errors;
}

/**
 * Eventos habilitados cujo offset lógico já foi alcançado e que ainda não
 * executaram. Eventos `enabled = false` nunca executam (§1.6).
 */
export function pendingScenarioEvents<T extends { id: string; offsetSeconds: number; enabled?: boolean | null }>(events: T[], elapsedSeconds: number, executedIds: Set<string>): T[] {
  return events
    .filter((event) => event.enabled !== false && event.offsetSeconds <= elapsedSeconds && !executedIds.has(event.id))
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

export interface DecisionLike {
  kind: string;
  offsetSeconds: number;
}

function targetOf(event: SimulationEventLike): string {
  const payload = event.payload as { targetId?: unknown } | null;
  return typeof payload?.targetId === "string" ? payload.targetId : "";
}

function appliedByType(events: SimulationEventLike[], types: SimulationEventType[]): SimulationEventLike[] {
  return events.filter((event) => event.result === "APPLIED" && (types as string[]).includes(event.eventType));
}

/** TRANSMISSION_FAILURE sem recuperação posterior para o mesmo alvo. */
export function countUnrecoveredTransmissionFailures(events: SimulationEventLike[]): number {
  const failures = appliedByType(events, TRANSMISSION_FAILURE_TYPES);
  const recoveries = appliedByType(events, TRANSMISSION_RECOVERY_TYPES);
  return failures.filter((failure) => !recoveries.some((recovery) => targetOf(recovery) === targetOf(failure) && recovery.offsetSeconds >= failure.offsetSeconds)).length;
}

/** Tempo médio (em segundos lógicos) entre falha e recuperação de transmissão. */
export function averageRecoverySeconds(events: SimulationEventLike[]): number {
  const diffs = recoveryDurations(events);
  return diffs.length ? Math.round(diffs.reduce((total, value) => total + value, 0) / diffs.length) : 0;
}

function recoveryDurations(events: SimulationEventLike[]): number[] {
  const failures = appliedByType(events, TRANSMISSION_FAILURE_TYPES);
  const recoveries = appliedByType(events, TRANSMISSION_RECOVERY_TYPES);
  return recoveries
    .map((recovery) => {
      const previous = failures
        .filter((failure) => targetOf(failure) === targetOf(recovery) && failure.offsetSeconds <= recovery.offsetSeconds)
        .reduce<SimulationEventLike | null>((latest, failure) => (!latest || failure.offsetSeconds > latest.offsetSeconds ? failure : latest), null);
      return previous ? recovery.offsetSeconds - previous.offsetSeconds : null;
    })
    .filter((value): value is number => value !== null);
}

/**
 * Deriva o estado bruto do score a partir do persistido. Função pura e
 * determinística: depende só de offsets e resultados, nunca do relógio.
 */
export function buildSimulationScoreInput(args: {
  scenarioEvents?: { offsetSeconds: number; enabled?: boolean | null }[] | null;
  events: SimulationEventLike[];
  incidents: IncidentLike[];
  decisions?: DecisionLike[];
  elapsedSeconds: number;
}): SimulationScoreInput {
  const scenarioEvents = args.scenarioEvents ?? [];
  const decisions = args.decisions ?? [];
  const applied = (types: SimulationEventType[]) => appliedByType(args.events, types).length;

  const incidentEvents = appliedByType(args.events, INCIDENT_TYPES);
  const responseOffsets = incidentEvents
    .map((incident) => {
      const candidates = [
        ...decisions.filter((decision) => decision.offsetSeconds >= incident.offsetSeconds).map((decision) => decision.offsetSeconds),
        ...appliedByType(args.events, TRANSMISSION_RECOVERY_TYPES).filter((recovery) => recovery.offsetSeconds >= incident.offsetSeconds).map((recovery) => recovery.offsetSeconds),
      ];
      return candidates.length ? Math.min(...candidates) - incident.offsetSeconds : null;
    })
    .filter((value): value is number => value !== null);
  const recoveryDiffs = recoveryDurations(args.events);

  const incidentsCreated = args.incidents.length;
  const incidentsResolved = args.incidents.filter((incident) => Boolean(incident.resolvedAt) || incident.status === IncidentStatus.RESOLVED || incident.status === IncidentStatus.CLOSED).length;
  const incidentsUnresolved = args.incidents.filter((incident) => ACTIVE_INCIDENT_STATUSES.includes(incident.status)).length;
  const deadlineMisses = args.incidents.filter((incident) => {
    if (!incident.slaDeadline) return false;
    if (incident.resolvedAt) return new Date(incident.resolvedAt).getTime() > new Date(incident.slaDeadline).getTime();
    return ACTIVE_INCIDENT_STATUSES.includes(incident.status);
  }).length;

  const transmissionFailures = applied(TRANSMISSION_FAILURE_TYPES);
  const transmissionRecoveries = applied(TRANSMISSION_RECOVERY_TYPES);
  const workforceObservations = applied(WORKFORCE_TYPES);
  const workforceShortages = applied(WORKFORCE_SHORTAGE_TYPES);
  const preparationObservations = applied(PREPARATION_TYPES);
  const preparationBlockers = applied(["PREPARATION_BLOCKER"]);
  const resourceRequestsCreated = applied(["RESOURCE_REQUEST_CREATE"]);
  const resourceRequestsFulfilled = Math.min(resourceRequestsCreated, decisions.filter((decision) => decision.kind === "REQUEST_RESOURCE").length);
  const criticalEventsApplied = applied(["INCIDENT_CRITICAL"]);
  const criticalEventsHandled = Math.min(criticalEventsApplied, decisions.filter((decision) => ["ESCALATE", "DISPATCH_TEAM", "RECLASSIFY_SEVERITY", "ABORT_OPERATION"].includes(decision.kind)).length);
  const decisionOpportunities = criticalEventsApplied + transmissionFailures + workforceShortages + preparationBlockers;

  return {
    plannedEvents: scenarioEvents.filter((event) => event.enabled !== false).length,
    appliedEvents: args.events.filter((event) => event.result === "APPLIED" && (event.eventType as SimulationEventType) in SIMULATION_EVENT_METADATA).length,
    incidentsCreated,
    incidentsResolved,
    incidentsUnresolved,
    incidentsWithDeadline: args.incidents.filter((incident) => Boolean(incident.slaDeadline)).length,
    deadlineMisses,
    respondedIncidents: responseOffsets.length,
    meanResponseSeconds: responseOffsets.length ? Math.round(responseOffsets.reduce((total, value) => total + value, 0) / responseOffsets.length) : null,
    transmissionObservations: transmissionFailures + transmissionRecoveries,
    transmissionFailures,
    transmissionRecoveries,
    recoverySamples: recoveryDiffs.length,
    meanRecoverySeconds: recoveryDiffs.length ? Math.round(recoveryDiffs.reduce((total, value) => total + value, 0) / recoveryDiffs.length) : null,
    workforceObservations,
    workforceShortages,
    resourceRequestsCreated,
    resourceRequestsFulfilled,
    preparationObservations,
    preparationBlockers,
    criticalEventsApplied,
    criticalEventsHandled,
    decisionOpportunities,
    decisionsRecorded: decisions.length,
  };
}
