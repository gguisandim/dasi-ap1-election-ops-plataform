import { Injectable, OnModuleInit } from "@nestjs/common";
import { AuditAction } from "@prisma/client";
import { EventBus, type DomainEvent, type DomainEventName } from "../../../../../packages/event-bus/src";
import { PrismaService } from "../../../../../packages/database/src";
const names: DomainEventName[] = ["incident.created", "incident.assigned", "incident.resolved", "asset.created", "asset.moved", "asset.status_changed", "user.created", "election.created", "route.created", "route.started", "route.completed", "delivery.completed", "delivery.failed", "transmission.completed", "transmission.failed", "transmission.connectivity_changed", "transmission.alert_created", "field_team.allocated", "field_member.checked_in", "field_member.checked_out", "preparation_checklist.approved", "preparation_checklist.blocked", "task.created", "task.assigned", "task.status_changed", "task.completed", "task.blocked", "shift.created", "shift.started", "shift.completed", "shift.assignment_changed", "shift.absence_registered", "shift.replacement_registered", "shift.coverage_insufficient"];
@Injectable()
export class AuditSubscriber implements OnModuleInit {
  constructor(private readonly bus: EventBus, private readonly prisma: PrismaService) {}
  onModuleInit() { for (const name of names) this.bus.subscribe(name, (event) => this.handle(event)); }
  private async handle(event: DomainEvent) {
    const action = event.name.endsWith(".created") ? AuditAction.CREATE : event.name.endsWith(".assigned") || event.name.endsWith(".moved") || event.name.endsWith(".assignment_changed") || event.name.endsWith(".replacement_registered") ? AuditAction.ASSIGN : AuditAction.STATUS_CHANGE;
    const entityType = event.name.startsWith("incident") ? "Incident" : event.name.startsWith("asset") ? "Asset" : event.name.startsWith("user") ? "User" : event.name.startsWith("route") ? "DistributionRoute" : event.name.startsWith("delivery") ? "Delivery" : event.name.startsWith("transmission") ? "TransmissionPoint" : event.name.startsWith("field_team") ? "FieldAllocation" : event.name.startsWith("field_member") ? "FieldMember" : event.name.startsWith("preparation_checklist") ? "PreparationChecklist" : event.name.startsWith("task") ? "Task" : event.name.startsWith("shift") ? "FieldShift" : "Election";
    const actorId = event.payload.actorId && await this.prisma.user.findUnique({ where: { id: event.payload.actorId }, select: { id: true } }) ? event.payload.actorId : undefined;
    await this.prisma.auditEvent.create({ data: { actorId, action, entityType, entityId: event.payload.entityId, newData: event.payload } });
  }
}
