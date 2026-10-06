import { AuditAction, AuditEventSeverity } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "@eops/database";
import { EventBus } from "@eops/event-bus";
import { sanitizeAuditValue } from "./audit.rules";
import {
  AuditSubscriber,
  inferAuditAction,
  inferEntityType,
} from "./audit.subscriber";

describe("AuditSubscriber", () => {
  it("observes every event through subscribeAll and enriches the persisted record", async () => {
    const bus = new EventBus();
    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValue({ id: "actor-1" }) },
      auditEvent: { create: vi.fn().mockResolvedValue({}) },
    } as unknown as PrismaService;
    const subscriber = new AuditSubscriber(bus, prisma);
    subscriber.onModuleInit();

    await bus.emit("incident.status_changed", {
      entityId: "incident-1",
      actorId: "actor-1",
      code: "INC-1",
      from: "NEW",
      to: "TRIAGED",
      reason: "Triagem concluída",
    });

    expect(prisma.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: "actor-1",
        eventName: "incident.status_changed",
        action: AuditAction.STATUS_CHANGE,
        entityType: "Incident",
        entityId: "incident-1",
        category: "incident",
        severity: AuditEventSeverity.WARNING,
        oldData: { value: "NEW" },
        newData: { value: "TRIAGED" },
        createdAt: expect.any(Date),
      }),
    });
  });

  it("persists the correlation id and copies election and zone scope from the payload", async () => {
    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValue(null) },
      auditEvent: { create: vi.fn().mockResolvedValue({}) },
    } as unknown as PrismaService;
    const subscriber = new AuditSubscriber(new EventBus(), prisma);

    await subscriber.handle({
      name: "field_team.allocated",
      payload: { entityId: "alloc-1", electionId: "election-1", electoralZoneId: "zone-1" },
      occurredAt: new Date("2026-10-06T10:00:00.000Z"),
      correlationId: "cid-9",
    });

    expect(prisma.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        electionId: "election-1",
        electoralZoneId: "zone-1",
        category: "field_team",
        severity: AuditEventSeverity.INFO,
        correlationId: "cid-9",
      }),
    });
  });

  it("redacts sensitive keys recursively without removing safe context", () => {
    expect(sanitizeAuditValue({
      email: "operator@example.test",
      passwordHash: "hash",
      nested: { Authorization: "Bearer token", apiKey: "key", safe: true },
      list: [{ secret: "value" }],
    })).toEqual({
      email: "operator@example.test",
      passwordHash: "[REDACTED]",
      nested: { Authorization: "[REDACTED]", apiKey: "[REDACTED]", safe: true },
      list: [{ secret: "[REDACTED]" }],
    });
  });

  it("infers action and entity for incident category and assignment events", () => {
    expect(inferAuditAction("incident.assigned")).toBe(AuditAction.ASSIGN);
    expect(inferAuditAction("incident.category_updated")).toBe(AuditAction.UPDATE);
    expect(inferEntityType("incident.category_updated")).toBe("IncidentCategory");
  });

  it("does not persist an arbitrary actor that is absent from the database", async () => {
    const bus = new EventBus();
    const prisma = { user: { findUnique: vi.fn().mockResolvedValue(null) }, auditEvent: { create: vi.fn().mockResolvedValue({}) } } as unknown as PrismaService;
    const subscriber = new AuditSubscriber(bus, prisma);
    subscriber.onModuleInit();
    await bus.emit("incident.comment_added", { entityId: "incident-1", actorId: "forged-actor", code: "INC-1", message: "Acompanhamento" });
    expect(prisma.auditEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ actorId: undefined, eventName: "incident.comment_added" }) });
  });
});
