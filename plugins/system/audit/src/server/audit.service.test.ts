import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { AuditAction, AuditEventSeverity } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "@eops/database";
import { AuditService } from "./audit.service";
import type { AuditQueryDto } from "./dto/audit-query.dto";

function query(overrides: Partial<AuditQueryDto> = {}): AuditQueryDto {
  return { from: "2026-01-01T00:00:00.000Z", to: "2026-01-31T00:00:00.000Z", page: 1, pageSize: 30, ...overrides };
}

function findRestricted(where: { category?: { in?: string[] }; AND?: unknown[] } | undefined): string[] | undefined {
  if (where?.category?.in) return where.category.in;
  for (const clause of where?.AND ?? []) {
    const found = findRestricted(clause as { category?: { in?: string[] }; AND?: unknown[] });
    if (found) return found;
  }
  return undefined;
}

function groupByMock(rows: Record<string, unknown[]>) {
  return vi.fn(async (args: { by: string[]; where?: { category?: { in?: string[] }; AND?: unknown[] } }) => {
    const key = args.by[0];
    const restricted = findRestricted(args.where);
    if (key === "category") {
      if (restricted) return restricted.map((category) => ({ category, _count: { _all: category === "incident" ? 3 : 2 } }));
      return rows.access ?? [];
    }
    return rows[key] ?? [];
  });
}

describe("AuditService", () => {
  it("applies filters, search and pagination", async () => {
    const prisma = {
      auditEvent: {
        groupBy: groupByMock({ access: [] }),
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
      },
    } as unknown as PrismaService;
    const result = await new AuditService(prisma).findAll(
      query({ eventName: "incident.escalated", search: "INC-1", action: AuditAction.STATUS_CHANGE, page: 2, pageSize: 10 }),
    );
    expect(prisma.auditEvent.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ eventName: { contains: "incident.escalated", mode: "insensitive" }, action: AuditAction.STATUS_CHANGE, OR: expect.any(Array) }),
      skip: 10,
      take: 10,
    }));
    expect(result).toMatchObject({ page: 2, pageSize: 10, total: 0, totalPages: 0, restrictedCategories: [] });
  });

  it("removes restricted rows and declares the categories without exposing omitted counts", async () => {
    const prisma = {
      auditEvent: {
        groupBy: groupByMock({ access: [{ category: "incident", _count: { _all: 3 } }, { category: "asset", _count: { _all: 2 } }] }),
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
      },
    } as unknown as PrismaService;
    const result = await new AuditService(prisma).findAll(query(), ["inventory.read"]);
    expect(prisma.auditEvent.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ category: { in: ["asset"] } }),
    }));
    expect(result.restrictedCategories).toEqual(["incident"]);
    expect(result).not.toHaveProperty("omitted");
    expect(result).not.toHaveProperty("hiddenCount");
  });

  it("recomputes summary counts and facets over the visible set", async () => {
    const prisma = {
      auditEvent: {
        groupBy: groupByMock({
          access: [{ category: "incident", _count: { _all: 3 } }, { category: "asset", _count: { _all: 2 } }],
          action: [{ action: AuditAction.UPDATE, _count: { _all: 2 } }],
          severity: [{ severity: AuditEventSeverity.NOTICE, _count: { _all: 2 } }],
          entityType: [{ entityType: "Asset", _count: { _all: 2 } }],
          actorId: [{ actorId: "actor-1", _count: { _all: 2 } }],
        }),
        count: vi.fn().mockResolvedValue(2),
      },
      user: { findMany: vi.fn().mockResolvedValue([{ id: "actor-1", name: "Ana", email: "ana@example.test" }]) },
    } as unknown as PrismaService;

    const summary = await new AuditService(prisma).summary(query(), ["inventory.read"]);
    expect(summary.byCategory).toEqual([{ key: "asset", count: 2 }]);
    expect(summary.bySeverity).toEqual([{ key: AuditEventSeverity.NOTICE, count: 2 }]);
    expect(summary.restrictedCategories).toEqual(["incident"]);
    expect(summary.total).toBe(2);
  });

  it("returns explorer facets computed on the visible categories", async () => {
    const prisma = {
      auditEvent: {
        groupBy: groupByMock({
          access: [{ category: "incident", _count: { _all: 3 } }, { category: "asset", _count: { _all: 2 } }],
          action: [{ action: AuditAction.UPDATE, _count: { _all: 2 } }],
          severity: [{ severity: AuditEventSeverity.NOTICE, _count: { _all: 2 } }],
          actorId: [{ actorId: "actor-1", _count: { _all: 2 } }],
        }),
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(2),
      },
      user: { findMany: vi.fn().mockResolvedValue([{ id: "actor-1", name: "Ana", email: "ana@example.test" }]) },
    } as unknown as PrismaService;

    const result = await new AuditService(prisma).explorer(query(), ["inventory.read"]);
    expect(result.facets.byCategory).toEqual([{ key: "asset", count: 2 }]);
    expect(result.facets.byAction).toEqual([{ key: AuditAction.UPDATE, count: 2 }]);
    expect(result.facets.byActor).toEqual([{ id: "actor-1", name: "Ana", count: 2 }]);
    expect(result.restrictedCategories).toEqual(["incident"]);
  });

  it("rejects a restricted entity timeline with 403 instead of an empty list", async () => {
    const prisma = {
      auditEvent: { groupBy: vi.fn().mockResolvedValue([]), findMany: vi.fn(), count: vi.fn() },
    } as unknown as PrismaService;
    await expect(new AuditService(prisma).entityTimeline("Incident", "incident-1", [])).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.auditEvent.findMany).not.toHaveBeenCalled();
  });

  it("returns an entity timeline scoped to the allowed category", async () => {
    const event = { id: "audit-1", eventName: "asset.created", entityType: "Asset", entityId: "asset-1", actor: null, oldData: null, newData: {}, metadata: {} };
    const prisma = {
      auditEvent: {
        groupBy: vi.fn().mockResolvedValue([{ category: "asset", _count: { _all: 1 } }]),
        findMany: vi.fn().mockResolvedValue([event]),
        count: vi.fn().mockResolvedValue(1),
      },
    } as unknown as PrismaService;
    const result = await new AuditService(prisma).entityTimeline("Asset", "asset-1", ["inventory.read"]);
    expect(prisma.auditEvent.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ category: { in: ["asset"] }, entityType: "Asset", entityId: "asset-1" }),
    }));
    expect(result.items).toHaveLength(1);
    expect(result.restrictedCategories).toEqual([]);
  });

  it("builds the correlation chain with audit events and gated notifications", async () => {
    const prisma = {
      auditEvent: {
        groupBy: vi.fn().mockResolvedValue([{ category: "incident", _count: { _all: 1 } }]),
        findMany: vi.fn().mockResolvedValue([{ id: "audit-1", category: "incident", actor: null, oldData: null, newData: {}, metadata: {} }]),
      },
      notification: {
        findMany: vi.fn().mockResolvedValue([
          { id: "note-1", eventName: "incident.created", entityType: "Incident", correlationId: "cid-1" },
          { id: "note-2", eventName: "asset.created", entityType: "Asset", correlationId: "cid-1" },
        ]),
      },
    } as unknown as PrismaService;
    const result = await new AuditService(prisma).correlation("cid-1", ["incidents.read"]);
    expect(result.events).toHaveLength(1);
    expect(result.notifications).toEqual([expect.objectContaining({ id: "note-1" })]);
  });

  it("returns the normalized diff for an audit event", async () => {
    const prisma = {
      auditEvent: {
        findUnique: vi.fn().mockResolvedValue({
          id: "audit-1",
          eventName: "incident.updated",
          entityType: "Incident",
          entityId: "incident-1",
          oldData: { status: "NEW", title: "A" },
          newData: { status: "TRIAGED", title: "A" },
        }),
      },
    } as unknown as PrismaService;
    const diff = await new AuditService(prisma).diff("audit-1");
    expect(diff).toMatchObject({ id: "audit-1", unchanged: 1, truncated: false });
    expect(diff.changed).toEqual([{ field: "status", before: "NEW", after: "TRIAGED" }]);
  });

  it("returns detail and rejects an unknown audit event", async () => {
    const event = { id: "audit-1", eventName: "incident.created", actor: null, oldData: null, newData: null, metadata: null };
    const prisma = { auditEvent: { findUnique: vi.fn().mockResolvedValueOnce(event).mockResolvedValueOnce(null) } } as unknown as PrismaService;
    const service = new AuditService(prisma);
    await expect(service.findOne("audit-1")).resolves.toMatchObject({ id: "audit-1" });
    await expect(service.findOne("missing")).rejects.toBeInstanceOf(NotFoundException);
  });
});
