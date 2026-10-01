export interface DomainEventMap {
  "incident.created": { entityId: string; actorId?: string; code: string; title: string; severity: string; electionId: string; pollingPlaceId?: string };
  "incident.assigned": { entityId: string; actorId?: string; code: string; assignedToName: string };
  "incident.resolved": { entityId: string; actorId?: string; code: string; title: string };
  "asset.created": { entityId: string; actorId?: string; assetTag: string; name: string };
  "asset.moved": { entityId: string; actorId?: string; assetTag: string; origin: string; destination: string; responsibleName: string };
  "asset.status_changed": { entityId: string; actorId?: string; assetTag: string; from: string; to: string };
  "user.created": { entityId: string; actorId?: string; email: string; name: string };
  "election.created": { entityId: string; actorId?: string; name: string; year: number };
}
export type DomainEventName = keyof DomainEventMap;
export interface DomainEvent<K extends DomainEventName = DomainEventName> { name: K; payload: DomainEventMap[K]; occurredAt: Date; }
export type DomainEventHandler<K extends DomainEventName> = (event: DomainEvent<K>) => void | Promise<void>;
