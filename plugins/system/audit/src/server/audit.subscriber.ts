import { Injectable, OnModuleInit } from "@nestjs/common";
import { AuditAction, Prisma } from "@prisma/client";
import { EventBus, type DomainEvent } from "@eops/event-bus";
import { PrismaService } from "@eops/database";

const sensitiveKeys = new Set(["password", "passwordhash", "authorization", "token", "secret", "apikey"]);

export function sanitizeAuditValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeAuditValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [
        key,
        sensitiveKeys.has(key.toLowerCase()) ? "[REDACTED]" : sanitizeAuditValue(child),
      ]),
    );
  }
  return value;
}

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
    const { oldData, newData } = auditData(payload);
    await this.prisma.auditEvent.create({
      data: {
        actorId,
        eventName: event.name,
        action: inferAuditAction(event.name),
        entityType: inferEntityType(event.name),
        entityId: typeof payload.entityId === "string" ? payload.entityId : undefined,
        oldData: oldData as Prisma.InputJsonValue | undefined,
        newData: newData as Prisma.InputJsonValue,
        metadata: sanitizeAuditValue({ occurredAt: event.occurredAt.toISOString() }) as Prisma.InputJsonValue,
        createdAt: event.occurredAt,
      },
    });
  }
}
