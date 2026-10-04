export interface DomainEventMap {
  "incident.created": {
    entityId: string;
    actorId?: string;
    code: string;
    title: string;
    severity: string;
    electionId: string;
    pollingPlaceId?: string;
  };

  "incident.assigned": {
    entityId: string;
    actorId?: string;
    code: string;
    assignedToId?: string;
    assignedToName: string;
    from?: string;
    to: string;
    reason?: string;
  };

  "incident.resolved": {
    entityId: string;
    actorId?: string;
    code: string;
    title: string;
    from: string;
    to: string;
    reason?: string;
  };

  "incident.updated": {
    entityId: string;
    actorId?: string;
    code: string;
    changes: Record<string, { from: unknown; to: unknown }>;
  };

  "incident.acknowledged": {
    entityId: string;
    actorId: string;
    code: string;
    acknowledgedAt: string;
  };

  "incident.status_changed": {
    entityId: string;
    actorId?: string;
    code: string;
    from: string;
    to: string;
    reason?: string;
  };

  "incident.severity_changed": {
    entityId: string;
    actorId?: string;
    code: string;
    from: string;
    to: string;
  };

  "incident.escalated": {
    entityId: string;
    actorId: string;
    code: string;
    from: number;
    to: number;
    reason: string;
  };

  "incident.comment_added": {
    entityId: string;
    actorId?: string;
    code: string;
    message: string;
  };

  "incident.reopened": {
    entityId: string;
    actorId?: string;
    code: string;
    from: string;
    to: string;
    reason?: string;
  };

  "incident.closed": {
    entityId: string;
    actorId?: string;
    code: string;
    from: string;
    to: string;
    reason?: string;
  };

  "incident.cancelled": {
    entityId: string;
    actorId?: string;
    code: string;
    from: string;
    to: string;
    reason?: string;
  };

  "incident.category_created": {
    entityId: string;
    actorId: string;
    key: string;
    name: string;
  };

  "incident.category_updated": {
    entityId: string;
    actorId: string;
    key: string;
    changes: Record<string, { from: unknown; to: unknown }>;
  };

  "asset.created": {
    entityId: string;
    actorId?: string;
    assetTag: string;
    name: string;
  };

  "asset.moved": {
    entityId: string;
    actorId?: string;
    assetTag: string;
    origin: string;
    destination: string;
    responsibleName: string;
  };

  "asset.status_changed": {
    entityId: string;
    actorId?: string;
    assetTag: string;
    from: string;
    to: string;
  };

  "user.created": {
    entityId: string;
    actorId?: string;
    email: string;
    name: string;
  };

  "election.created": {
    entityId: string;
    actorId?: string;
    name: string;
    year: number;
  };

  "route.created": {
    entityId: string;
    actorId?: string;
    code: string;
    name: string;
    electionId: string;
    electoralZoneId: string;
  };

  "route.started": {
    entityId: string;
    actorId?: string;
    code: string;
    departedAt: string;
  };

  "route.completed": {
    entityId: string;
    actorId?: string;
    code: string;
    arrivedAt: string;
  };

  "delivery.completed": {
    entityId: string;
    actorId?: string;
    routeId: string;
    pollingPlaceId: string;
  };

  "delivery.failed": {
    entityId: string;
    actorId?: string;
    routeId: string;
    pollingPlaceId: string;
    reason: string;
  };

  "transmission.completed": {
    entityId: string;
    actorId?: string;
    identification: string;
    electionId: string;
    electoralZoneId: string;
    attemptNumber: number;
  };

  "transmission.failed": {
    entityId: string;
    actorId?: string;
    identification: string;
    electionId: string;
    electoralZoneId: string;
    attemptNumber: number;
    error: string;
  };

  "transmission.connectivity_changed": {
    entityId: string;
    actorId?: string;
    identification: string;
    from: string;
    to: string;
  };

  "transmission.alert_created": {
    entityId: string;
    actorId?: string;
    pointId: string;
    identification: string;
    alertType: string;
    message: string;
  };

  "field_team.allocated": {
    entityId: string;
    actorId?: string;
    teamId?: string;
    memberId?: string;
    electionId: string;
    electoralZoneId?: string;
    pollingPlaceId?: string;
    routeId?: string;
  };

  "field_member.checked_in": {
    entityId: string;
    actorId?: string;
    memberId: string;
    memberName: string;
    electoralZoneId?: string;
    pollingPlaceId?: string;
    occurredAt: string;
  };

  "field_member.checked_out": {
    entityId: string;
    actorId?: string;
    memberId: string;
    memberName: string;
    electoralZoneId?: string;
    pollingPlaceId?: string;
    occurredAt: string;
  };

  "communication.created": {
    entityId: string;
    actorId?: string;
    code: string;
    title: string;
    priority: string;
    electionId: string;
    status: string;
  };

  "communication.published": {
    entityId: string;
    actorId?: string;
    code: string;
    title: string;
    priority: string;
    electionId: string;
    recipientCount: number;
  };

  "communication.cancelled": {
    entityId: string;
    actorId?: string;
    code: string;
    title: string;
    reason?: string;
  };

  "communication.expired": {
    entityId: string;
    actorId?: string;
    code: string;
    title: string;
    expiredAt: string;
  };

  "communication.archived": {
    entityId: string;
    actorId?: string;
    code: string;
    title: string;
  };

  "communication.read": {
    entityId: string;
    actorId?: string;
    communicationId: string;
    recipientId: string;
    recipientName: string;
    code: string;
  };

  "communication.acknowledged": {
    entityId: string;
    actorId?: string;
    communicationId: string;
    recipientId: string;
    recipientName: string;
    code: string;
    title: string;
  };

  "evidence.created": {
    entityId: string;
    actorId?: string;
    code: string;
    title: string;
    type: string;
    size: number;
    checksum: string;
  };

  "evidence.versioned": {
    entityId: string;
    actorId?: string;
    code: string;
    title: string;
    version: number;
    size: number;
    checksum: string;
  };

  "evidence.archived": {
    entityId: string;
    actorId?: string;
    code: string;
    title: string;
  };

  "runbook.created": {
    entityId: string;
    actorId?: string;
    code: string;
    title: string;
    categoryKey?: string;
  };

  "runbook.published": {
    entityId: string;
    actorId?: string;
    code: string;
    title: string;
    stepCount: number;
  };

  "runbook.matched": {
    entityId: string;
    actorId?: string;
    incidentId?: string;
    matchCount: number;
  };

  "runbook.executed": {
    entityId: string;
    actorId?: string;
    code: string;
    title: string;
    outcome: string;
    resolved: boolean;
    incidentId?: string;
  };

  "risk.created": {
    entityId: string;
    actorId?: string;
    code: string;
    title: string;
    electionId: string;
    score: number;
    level: string;
  };

  "risk.escalated": {
    entityId: string;
    actorId?: string;
    code: string;
    title: string;
    fromLevel: string;
    toLevel: string;
    score: number;
  };

  "risk.materialized": {
    entityId: string;
    actorId?: string;
    code: string;
    title: string;
    level: string;
    actualImpact: string;
    incidentId?: string;
  };

  "risk.closed": {
    entityId: string;
    actorId?: string;
    code: string;
    title: string;
    level: string;
  };

  "preparation_checklist.approved": {
    entityId: string;
    actorId?: string;
    checklistId: string;
    electionId: string;
    electoralZoneId: string;
    pollingPlaceId: string;
    approvedBy: string;
    approvedAt: string;
  };

  "preparation_checklist.blocked": {
    entityId: string;
    actorId?: string;
    checklistId: string;
    electionId: string;
    pollingPlaceId: string;
    reason: string;
  };

  "task.created": {
    entityId: string;
    actorId?: string;
    title: string;
    electionId: string;
    priority: string;
  };

  "task.assigned": {
    entityId: string;
    actorId?: string;
    title: string;
    electionId: string;
    assigneeId: string | null;
  };

  "task.status_changed": {
    entityId: string;
    actorId?: string;
    title: string;
    electionId: string;
    from: string;
    to: string;
  };

  "task.completed": {
    entityId: string;
    actorId?: string;
    title: string;
    electionId: string;
  };

  "task.blocked": {
    entityId: string;
    actorId?: string;
    title: string;
    electionId: string;
    reason: string;
  };

  "shift.created": {
    entityId: string;
    actorId?: string;
    name: string;
    electionId: string;
    teamId: string;
    startsAt: string;
    endsAt: string;
  };
  "shift.started": {
    entityId: string;
    actorId?: string;
    name: string;
    electionId: string;
  };
  "shift.completed": {
    entityId: string;
    actorId?: string;
    name: string;
    electionId: string;
  };
  "shift.assignment_changed": {
    entityId: string;
    actorId?: string;
    shiftId: string;
    electionId: string;
    memberId: string;
    memberName: string;
    change: string;
  };
  "shift.absence_registered": {
    entityId: string;
    actorId?: string;
    shiftId: string;
    electionId: string;
    memberId: string;
    memberName: string;
    reason?: string;
  };
  "shift.replacement_registered": {
    entityId: string;
    actorId?: string;
    shiftId: string;
    electionId: string;
    originalMemberId: string;
    substituteMemberId: string;
    substituteName: string;
  };
  "shift.coverage_insufficient": {
    entityId: string;
    actorId?: string;
    name: string;
    electionId: string;
    requiredOperators: number;
    availableOperators: number;
  };
}

export type DomainEventName = keyof DomainEventMap;

export interface DomainEvent<K extends DomainEventName = DomainEventName> {
  name: K;
  payload: DomainEventMap[K];
  occurredAt: Date;
}

export type DomainEventHandler<K extends DomainEventName> = (
  event: DomainEvent<K>,
) => void | Promise<void>;

export interface NotificationEventDefinition {
  eventName: DomainEventName;
  domain: string;
  label: string;
  description: string;
  requiredPermission?: string;
}

export const NOTIFICATION_EVENT_CATALOG = [
  { eventName: "incident.created", domain: "Incidentes", label: "Novo incidente", description: "Incidente registrado na operação.", requiredPermission: "incidents.read" },
  { eventName: "incident.acknowledged", domain: "Incidentes", label: "Incidente reconhecido", description: "Um operador assumiu conhecimento do incidente.", requiredPermission: "incidents.read" },
  { eventName: "incident.assigned", domain: "Incidentes", label: "Incidente atribuído", description: "Responsável pelo atendimento alterado.", requiredPermission: "incidents.read" },
  { eventName: "incident.escalated", domain: "Incidentes", label: "Incidente escalado", description: "Nível de escalonamento aumentado.", requiredPermission: "incidents.read" },
  { eventName: "incident.resolved", domain: "Incidentes", label: "Incidente resolvido", description: "Incidente marcado como resolvido.", requiredPermission: "incidents.read" },
  { eventName: "incident.reopened", domain: "Incidentes", label: "Incidente reaberto", description: "Incidente retornou ao atendimento.", requiredPermission: "incidents.read" },
  { eventName: "incident.closed", domain: "Incidentes", label: "Incidente fechado", description: "Incidente encerrado definitivamente.", requiredPermission: "incidents.read" },
  { eventName: "incident.comment_added", domain: "Incidentes", label: "Comentário adicionado", description: "Novo comentário na timeline.", requiredPermission: "incidents.read" },
  { eventName: "asset.status_changed", domain: "Inventário", label: "Status de ativo alterado", description: "Ativo mudou de estado operacional.", requiredPermission: "inventory.read" },
  { eventName: "transmission.failed", domain: "Transmissão", label: "Falha de transmissão", description: "Ponto registrou falha de transmissão.", requiredPermission: "transmission.read" },
  { eventName: "transmission.connectivity_changed", domain: "Transmissão", label: "Conectividade alterada", description: "Conectividade do ponto mudou.", requiredPermission: "transmission.read" },
  { eventName: "task.assigned", domain: "Tarefas", label: "Tarefa atribuída", description: "Responsável de uma tarefa foi alterado.", requiredPermission: "tasks.read" },
  { eventName: "task.blocked", domain: "Tarefas", label: "Tarefa bloqueada", description: "Tarefa encontrou impedimento.", requiredPermission: "tasks.read" },
  { eventName: "shift.coverage_insufficient", domain: "Escalas", label: "Cobertura insuficiente", description: "Turno sem operadores suficientes.", requiredPermission: "shifts.read" },
] as const satisfies readonly NotificationEventDefinition[];

export function requiredPermissionForEvent(name: DomainEventName): string | undefined {
  const configured = NOTIFICATION_EVENT_CATALOG.find((item) => item.eventName === name);
  if (configured?.requiredPermission) return configured.requiredPermission;
  if (name.startsWith("incident.")) return "incidents.read";
  if (name.startsWith("asset.")) return "inventory.read";
  if (name.startsWith("transmission.")) return "transmission.read";
  if (name.startsWith("task.")) return "tasks.read";
  if (name.startsWith("shift.")) return "shifts.read";
  if (name.startsWith("route.") || name.startsWith("delivery.")) return "routes.read";
  if (name.startsWith("field_team.") || name.startsWith("field_member.")) return "field-teams.read";
  if (name.startsWith("communication.")) return "communications.read";
  if (name.startsWith("evidence.")) return "evidence.read";
  if (name.startsWith("runbook.")) return "knowledge.read";
  if (name.startsWith("risk.")) return "risks.read";
  if (name.startsWith("preparation_checklist.")) return "preparation-checklists.read";
  if (name.startsWith("user.")) return "users.read";
  if (name.startsWith("election.")) return "elections.read";
  return undefined;
}
