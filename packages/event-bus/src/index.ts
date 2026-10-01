import { Global, Injectable, Module } from "@nestjs/common";

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
type Handler<K extends DomainEventName> = (event: DomainEvent<K>) => void | Promise<void>;

@Injectable()
export class EventBus {
  private readonly handlers = new Map<DomainEventName, Set<Handler<DomainEventName>>>();
  subscribe<K extends DomainEventName>(name: K, handler: Handler<K>) {
    const handlers = this.handlers.get(name) ?? new Set<Handler<DomainEventName>>();
    handlers.add(handler as Handler<DomainEventName>); this.handlers.set(name, handlers);
    return () => handlers.delete(handler as Handler<DomainEventName>);
  }
  async emit<K extends DomainEventName>(name: K, payload: DomainEventMap[K]) {
    const event: DomainEvent<K> = { name, payload, occurredAt: new Date() };
    await Promise.all([...(this.handlers.get(name) ?? [])].map((handler) => handler(event as DomainEvent<DomainEventName>)));
  }
}

@Global() @Module({ providers: [EventBus], exports: [EventBus] }) export class EventBusModule {}
