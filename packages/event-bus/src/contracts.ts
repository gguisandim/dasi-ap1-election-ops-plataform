export interface DomainEventMap {
  "incident.created": { entityId: string; actorId?: string; code: string; title: string; severity: string; electionId: string; pollingPlaceId?: string };
  "incident.assigned": { entityId: string; actorId?: string; code: string; assignedToName: string };
  "incident.resolved": { entityId: string; actorId?: string; code: string; title: string };
  "asset.created": { entityId: string; actorId?: string; assetTag: string; name: string };
  "asset.moved": { entityId: string; actorId?: string; assetTag: string; origin: string; destination: string; responsibleName: string };
  "asset.status_changed": { entityId: string; actorId?: string; assetTag: string; from: string; to: string };
  "user.created": { entityId: string; actorId?: string; email: string; name: string };
  "election.created": { entityId: string; actorId?: string; name: string; year: number };
  "route.created": { entityId: string; actorId?: string; code: string; name: string; electionId: string; electoralZoneId: string };
  "route.started": { entityId: string; actorId?: string; code: string; departedAt: string };
  "route.completed": { entityId: string; actorId?: string; code: string; arrivedAt: string };
  "delivery.completed": { entityId: string; actorId?: string; routeId: string; pollingPlaceId: string };
  "delivery.failed": { entityId: string; actorId?: string; routeId: string; pollingPlaceId: string; reason: string };
  "transmission.completed": { entityId: string; actorId?: string; identification: string; electionId: string; electoralZoneId: string; attemptNumber: number };
  "transmission.failed": { entityId: string; actorId?: string; identification: string; electionId: string; electoralZoneId: string; attemptNumber: number; error: string };
  "transmission.connectivity_changed": { entityId: string; actorId?: string; identification: string; from: string; to: string };
  "transmission.alert_created": { entityId: string; actorId?: string; pointId: string; identification: string; alertType: string; message: string };
  "field_team.allocated": { entityId: string; actorId?: string; teamId?: string; memberId?: string; electionId: string; electoralZoneId?: string; pollingPlaceId?: string; routeId?: string };
  "field_member.checked_in": { entityId: string; actorId?: string; memberId: string; memberName: string; electoralZoneId?: string; pollingPlaceId?: string; occurredAt: string };
  "field_member.checked_out": { entityId: string; actorId?: string; memberId: string; memberName: string; electoralZoneId?: string; pollingPlaceId?: string; occurredAt: string };
  "preparation_checklist.approved": { entityId: string; actorId?: string; checklistId: string; electionId: string; electoralZoneId: string; pollingPlaceId: string; approvedBy: string; approvedAt: string };
  "preparation_checklist.blocked": { entityId: string; actorId?: string; checklistId: string; electionId: string; pollingPlaceId: string; reason: string };
}
export type DomainEventName = keyof DomainEventMap;
export interface DomainEvent<K extends DomainEventName = DomainEventName> { name: K; payload: DomainEventMap[K]; occurredAt: Date; }
export type DomainEventHandler<K extends DomainEventName> = (event: DomainEvent<K>) => void | Promise<void>;
