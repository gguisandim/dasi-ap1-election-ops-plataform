import { Injectable, OnModuleInit } from "@nestjs/common";
import { AuditAction } from "@prisma/client";
import { EventBus, type DomainEvent, type DomainEventName } from "../../../../../packages/event-bus/src";
import { PrismaService } from "../../../../../packages/database/src";
const names: DomainEventName[] = ["incident.created", "incident.assigned", "incident.resolved", "asset.created", "asset.moved", "asset.status_changed", "user.created", "election.created"];
@Injectable()
export class AuditSubscriber implements OnModuleInit {
  constructor(private readonly bus: EventBus, private readonly prisma: PrismaService) {}
  onModuleInit() { for (const name of names) this.bus.subscribe(name, (event) => this.handle(event)); }
  private async handle(event: DomainEvent) {
    const action = event.name.endsWith(".created") ? AuditAction.CREATE : event.name.endsWith(".assigned") || event.name.endsWith(".moved") ? AuditAction.ASSIGN : AuditAction.STATUS_CHANGE;
    const entityType = event.name.startsWith("incident") ? "Incident" : event.name.startsWith("asset") ? "Asset" : event.name.startsWith("user") ? "User" : "Election";
    const actorId = event.payload.actorId && await this.prisma.user.findUnique({ where: { id: event.payload.actorId }, select: { id: true } }) ? event.payload.actorId : undefined;
    await this.prisma.auditEvent.create({ data: { actorId, action, entityType, entityId: event.payload.entityId, newData: event.payload } });
  }
}
