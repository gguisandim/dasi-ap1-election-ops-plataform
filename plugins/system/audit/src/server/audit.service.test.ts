import { NotFoundException } from "@nestjs/common";
import { AuditAction } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "@eops/database";
import { AuditService } from "./audit.service";

describe("AuditService", () => {
  it("applies filters, search and pagination", async () => {
    const prisma = {
      auditEvent: {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
      },
    } as unknown as PrismaService;
    const result = await new AuditService(prisma).findAll({
      eventName: "incident.escalated",
      search: "INC-1",
      action: AuditAction.STATUS_CHANGE,
      page: 2,
      pageSize: 10,
    });
    expect(prisma.auditEvent.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ eventName: "incident.escalated", action: AuditAction.STATUS_CHANGE, OR: expect.any(Array) }),
      skip: 10,
      take: 10,
    }));
    expect(result).toMatchObject({ page: 2, pageSize: 10, total: 0, totalPages: 0 });
  });

  it("builds a compact summary", async () => {
    const prisma = {
      auditEvent: {
        count: vi.fn().mockResolvedValueOnce(7).mockResolvedValueOnce(2),
        groupBy: vi.fn()
          .mockResolvedValueOnce([{ action: AuditAction.UPDATE, _count: { _all: 4 } }])
          .mockResolvedValueOnce([{ entityType: "Incident", _count: { _all: 5 } }])
          .mockResolvedValueOnce([{ actorId: "actor-1", _count: { _all: 3 } }]),
      },
      user: { findMany: vi.fn().mockResolvedValue([{ id: "actor-1", name: "Operador", email: "op@example.test" }]) },
    } as unknown as PrismaService;
    const summary = await new AuditService(prisma).summary({ page: 1, pageSize: 30 });
    expect(summary).toMatchObject({
      total: 7,
      today: 2,
      byAction: [{ action: AuditAction.UPDATE, count: 4 }],
      topEntities: [{ entityType: "Incident", count: 5 }],
      topActors: [{ actor: { id: "actor-1", name: "Operador" }, count: 3 }],
    });
  });

  it("returns detail and rejects an unknown audit event", async () => {
    const event = { id: "audit-1", eventName: "incident.created", actor: null };
    const prisma = { auditEvent: { findUnique: vi.fn().mockResolvedValueOnce(event).mockResolvedValueOnce(null) } } as unknown as PrismaService;
    const service = new AuditService(prisma);
    await expect(service.findOne("audit-1")).resolves.toEqual(event);
    await expect(service.findOne("missing")).rejects.toBeInstanceOf(NotFoundException);
  });
});
