import type { PostmortemTimelineSource } from "@eops/shared/postmortems";

/**
 * Construção da timeline analítica a partir do que os domínios de origem já
 * registram. A função é pura: recebe as linhas carregadas e devolve candidatos
 * determinísticos. O serviço apenas grava, usando `skipDuplicates` sobre a
 * chave única (postmortemId, sourceType, sourceId) para garantir idempotência.
 */

export interface TimelineCandidate {
  sourceType: PostmortemTimelineSource;
  sourceId: string;
  occurredAt: Date;
  title: string;
  description: string | null;
}

export function candidateKey(
  sourceType: PostmortemTimelineSource,
  sourceId: string,
): string {
  return `${sourceType}:${sourceId}`;
}

export interface IncidentTimelineRow {
  id: string;
  code: string;
  title: string;
  openedAt: Date;
  acknowledgedAt: Date | null;
  escalatedAt: Date | null;
  escalationLevel: number;
  resolvedAt: Date | null;
  closedAt: Date | null;
}

export interface IncidentEventRow {
  id: string;
  type: string;
  message: string;
  createdAt: Date;
  actorId?: string | null;
}

export interface HandoverTimelineRow {
  id: string;
  status: string;
  submittedAt: Date | null;
  confirmedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  shiftName: string | null;
}

export interface ResourceRequestTimelineRow {
  id: string;
  code: string;
  title: string;
  status: string;
  priority: string;
  createdAt: Date;
  submittedAt: Date | null;
  approvedAt: Date | null;
  fulfilledAt: Date | null;
  rejectedAt: Date | null;
}

export interface TaskTimelineRow {
  id: string;
  title: string;
  status: string;
  priority: string;
  createdAt: Date;
  completedAt: Date | null;
}

export function incidentMilestones(
  incident: IncidentTimelineRow,
): TimelineCandidate[] {
  const candidates: TimelineCandidate[] = [
    {
      sourceType: "INCIDENT_EVENT",
      sourceId: `incident:${incident.id}:opened`,
      occurredAt: incident.openedAt,
      title: `Incidente ${incident.code} aberto`,
      description: incident.title,
    },
  ];
  if (incident.acknowledgedAt)
    candidates.push({
      sourceType: "INCIDENT_EVENT",
      sourceId: `incident:${incident.id}:acknowledged`,
      occurredAt: incident.acknowledgedAt,
      title: `Incidente ${incident.code} reconhecido`,
      description: null,
    });
  if (incident.escalatedAt)
    candidates.push({
      sourceType: "INCIDENT_EVENT",
      sourceId: `incident:${incident.id}:escalated`,
      occurredAt: incident.escalatedAt,
      title: `Incidente ${incident.code} escalado`,
      description: `Nível de escalonamento ${incident.escalationLevel}.`,
    });
  if (incident.resolvedAt)
    candidates.push({
      sourceType: "INCIDENT_EVENT",
      sourceId: `incident:${incident.id}:resolved`,
      occurredAt: incident.resolvedAt,
      title: `Incidente ${incident.code} resolvido`,
      description: null,
    });
  if (incident.closedAt)
    candidates.push({
      sourceType: "INCIDENT_EVENT",
      sourceId: `incident:${incident.id}:closed`,
      occurredAt: incident.closedAt,
      title: `Incidente ${incident.code} encerrado`,
      description: null,
    });
  return candidates;
}

export function incidentEventCandidates(
  events: readonly IncidentEventRow[],
): TimelineCandidate[] {
  return events.map((event) => ({
    sourceType: "INCIDENT_EVENT",
    sourceId: `incident-event:${event.id}`,
    occurredAt: event.createdAt,
    title: event.type,
    description: event.message,
  }));
}

export function handoverCandidates(
  handovers: readonly HandoverTimelineRow[],
): TimelineCandidate[] {
  const candidates: TimelineCandidate[] = [];
  for (const handover of handovers) {
    const label = handover.shiftName ?? "turno";
    if (handover.submittedAt)
      candidates.push({
        sourceType: "SHIFT_HANDOVER",
        sourceId: `shift-handover:${handover.id}:submitted`,
        occurredAt: handover.submittedAt,
        title: `Passagem de turno submetida (${label})`,
        description: null,
      });
    if (handover.confirmedAt)
      candidates.push({
        sourceType: "SHIFT_HANDOVER",
        sourceId: `shift-handover:${handover.id}:confirmed`,
        occurredAt: handover.confirmedAt,
        title: `Passagem de turno confirmada (${label})`,
        description: null,
      });
    if (handover.cancelledAt)
      candidates.push({
        sourceType: "SHIFT_HANDOVER",
        sourceId: `shift-handover:${handover.id}:cancelled`,
        occurredAt: handover.cancelledAt,
        title: `Passagem de turno cancelada (${label})`,
        description: null,
      });
  }
  return candidates;
}

export function resourceRequestCandidates(
  requests: readonly ResourceRequestTimelineRow[],
): TimelineCandidate[] {
  const candidates: TimelineCandidate[] = [];
  for (const request of requests) {
    const label = `${request.code}: ${request.title}`;
    const milestones: Array<[Date | null, string, string]> = [
      [request.submittedAt, "submetida", "submitted"],
      [request.approvedAt, "aprovada", "approved"],
      [request.fulfilledAt, "atendida", "fulfilled"],
      [request.rejectedAt, "rejeitada", "rejected"],
    ];
    for (const [occurredAt, verb, suffix] of milestones) {
      if (!occurredAt) continue;
      candidates.push({
        sourceType: "RESOURCE_REQUEST",
        sourceId: `resource-request:${request.id}:${suffix}`,
        occurredAt,
        title: `Solicitação de recurso ${verb}`,
        description: label,
      });
    }
    if (
      !request.submittedAt &&
      !request.approvedAt &&
      !request.fulfilledAt &&
      !request.rejectedAt
    ) {
      candidates.push({
        sourceType: "RESOURCE_REQUEST",
        sourceId: `resource-request:${request.id}:created`,
        occurredAt: request.createdAt,
        title: "Solicitação de recurso registrada",
        description: label,
      });
    }
  }
  return candidates;
}

export function taskCandidates(
  tasks: readonly TaskTimelineRow[],
): TimelineCandidate[] {
  const candidates: TimelineCandidate[] = [];
  for (const task of tasks) {
    candidates.push({
      sourceType: "TASK",
      sourceId: `task:${task.id}:created`,
      occurredAt: task.createdAt,
      title: "Tarefa operacional criada",
      description: task.title,
    });
    if (task.completedAt)
      candidates.push({
        sourceType: "TASK",
        sourceId: `task:${task.id}:completed`,
        occurredAt: task.completedAt,
        title: "Tarefa operacional concluída",
        description: task.title,
      });
  }
  return candidates;
}

export interface ImportPlan {
  toCreate: TimelineCandidate[];
  skipped: number;
}

/**
 * Remove duplicatas dentro do próprio lote e candidatos cuja chave já existe no
 * postmortem. Reimportar a mesma origem nunca cria uma segunda entrada.
 */
export function planTimelineImport(
  candidates: readonly TimelineCandidate[],
  existingKeys: ReadonlySet<string>,
): ImportPlan {
  const seen = new Set<string>();
  const toCreate: TimelineCandidate[] = [];
  let skipped = 0;
  for (const candidate of [...candidates].sort(
    (left, right) =>
      left.occurredAt.getTime() - right.occurredAt.getTime() ||
      candidateKey(left.sourceType, left.sourceId).localeCompare(
        candidateKey(right.sourceType, right.sourceId),
      ),
  )) {
    const key = candidateKey(candidate.sourceType, candidate.sourceId);
    if (existingKeys.has(key) || seen.has(key)) {
      skipped += 1;
      continue;
    }
    seen.add(key);
    toCreate.push(candidate);
  }
  return { toCreate, skipped };
}
