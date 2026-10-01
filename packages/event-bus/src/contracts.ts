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
    assignedToName: string;
  };

  "incident.resolved": {
    entityId: string;
    actorId?: string;
    code: string;
    title: string;
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