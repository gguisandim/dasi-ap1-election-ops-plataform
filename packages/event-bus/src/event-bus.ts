import { Injectable } from "@nestjs/common";
import { currentCorrelationId } from "@eops/shared/correlation";
import type { DomainEvent, DomainEventHandler, DomainEventMap, DomainEventName } from "./contracts";

@Injectable()
export class EventBus {
  private readonly handlers = new Map<DomainEventName, Set<DomainEventHandler<DomainEventName>>>();
  private readonly allHandlers = new Set<DomainEventHandler<DomainEventName>>();

  subscribe<K extends DomainEventName>(name: K, handler: DomainEventHandler<K>) {
    const handlers = this.handlers.get(name) ?? new Set<DomainEventHandler<DomainEventName>>();
    handlers.add(handler as DomainEventHandler<DomainEventName>);
    this.handlers.set(name, handlers);
    return () => handlers.delete(handler as DomainEventHandler<DomainEventName>);
  }

  subscribeAll(handler: DomainEventHandler<DomainEventName>) {
    this.allHandlers.add(handler);
    return () => this.allHandlers.delete(handler);
  }

  async emit<K extends DomainEventName>(name: K, payload: DomainEventMap[K]) {
    const event: DomainEvent<K> = {
      name,
      payload,
      occurredAt: new Date(),
      correlationId: currentCorrelationId(),
    };
    await Promise.all(
      [...(this.handlers.get(name) ?? []), ...this.allHandlers].map((handler) =>
        handler(event as DomainEvent<DomainEventName>),
      ),
    );
  }
}
