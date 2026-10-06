import { Injectable, OnModuleInit } from "@nestjs/common";
import { AuditAction, Prisma } from "@prisma/client";
import { EventBus, type DomainEvent } from "@eops/event-bus";
import { PrismaService } from "@eops/database";
import {
  copyScopeFields,
  deriveCategory,
  deriveSeverity,
  sanitizeAuditValue,
  truncateAuditPayload,
} from "./audit.rules";

export function inferAuditAction(eventName: string): AuditAction {
  if (eventName.endsWith(".created") || eventName.endsWith(".category_created")) return AuditAction.CREATE;
  if (eventName.endsWith(".assigned") || eventName.endsWith(".moved") || eventName.includes("assignment")) return AuditAction.ASSIGN;
  if (
    eventName.endsWith(".status_changed") ||
    eventName.endsWith(".resolved") ||
    eventName.endsWith(".reopened") ||
    eventName.endsWith(".closed") ||
    eventName.endsWith(".cancelled") ||
    eventName.endsWith(".escalated")
  ) return AuditAction.STATUS_CHANGE;
  return AuditAction.UPDATE;
}

export function inferEntityType(eventName: string): string {
  if (eventName.startsWith("incident.category_")) return "IncidentCategory";
  if (eventName === "command_center.snapshot_created")
    return "CommandCenterSnapshot";
  if (eventName === "command_center.shared_view_created")
    return "CommandCenterSavedView";
  if (eventName === "postmortem.action_overdue") return "PostmortemActionItem";
  const prefix = eventName.split(".")[0];
  const entities: Record<string, string> = {
    incident: "Incident",
    asset: "Asset",
    user: "User",
    election: "Election",
    route: "DistributionRoute",
    delivery: "Delivery",
    transmission: "TransmissionPoint",
    field_team: "FieldAllocation",
    field_member: "FieldMember",
    communication: "Communication",
    evidence: "Evidence",
    runbook: "Runbook",
    risk: "Risk",
    preparation_checklist: "PreparationChecklist",
    task: "Task",
    shift: "FieldShift",
    resource_request: "ResourceRequest",
    postmortem: "Postmortem",
    command_center: "CommandCenterSnapshot",
  };
  return entities[prefix] ?? prefix;
}

function auditData(payload: Record<string, unknown>) {
  if (payload.changes && typeof payload.changes === "object" && !Array.isArray(payload.changes)) {
    const entries = Object.entries(payload.changes as Record<string, { from?: unknown; to?: unknown }>);
    return {
      oldData: sanitizeAuditValue(Object.fromEntries(entries.map(([key, value]) => [key, value.from ?? null]))),
      newData: sanitizeAuditValue(Object.fromEntries(entries.map(([key, value]) => [key, value.to ?? null]))),
    };
  }
  if ("from" in payload && "to" in payload) {
    return {
      oldData: sanitizeAuditValue({ value: payload.from }),
      newData: sanitizeAuditValue({ value: payload.to }),
    };
  }
  return { oldData: undefined, newData: sanitizeAuditValue(payload) };
}

@Injectable()
export class AuditSubscriber implements OnModuleInit {
  constructor(
    private readonly bus: EventBus,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    this.bus.subscribeAll((event) => this.handle(event));
  }

  async handle(event: DomainEvent) {
    const payload = event.payload as Record<string, unknown>;
    const requestedActorId = typeof payload.actorId === "string" ? payload.actorId : undefined;
    const actorId = requestedActorId && await this.prisma.user.findUnique({ where: { id: requestedActorId }, select: { id: true } })
      ? requestedActorId
      : undefined;
    const entityType = inferEntityType(event.name);
    const { oldData, newData } = auditData(payload);
    const scope = copyScopeFields(payload);
    await this.prisma.auditEvent.create({
      data: {
        actorId,
        eventName: event.name,
        action: inferAuditAction(event.name),
        entityType,
        entityId: typeof payload.entityId === "string" ? payload.entityId : undefined,
        category: deriveCategory(event.name, entityType),
        severity: deriveSeverity(event.name),
        correlationId: event.correlationId,
        electionId: scope.electionId,
        electoralZoneId: scope.electoralZoneId,
        oldData: truncateAuditPayload(oldData) as Prisma.InputJsonValue | undefined,
        newData: truncateAuditPayload(newData) as Prisma.InputJsonValue,
        metadata: truncateAuditPayload(sanitizeAuditValue({ occurredAt: event.occurredAt.toISOString() })) as Prisma.InputJsonValue,
        createdAt: event.occurredAt,
      },
    });
  }
}
