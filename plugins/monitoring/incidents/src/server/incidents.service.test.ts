import { BadRequestException } from "@nestjs/common";
import { IncidentSeverity, IncidentStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "@eops/database";
import { IncidentsService } from "./incidents.service";

function incident(overrides: Record<string, unknown> = {}) {
  return {
    id: "incident-1", code: "INC-00001", title: "Falha de rede", description: "Sem conectividade",
    severity: IncidentSeverity.HIGH, status: IncidentStatus.NEW, electionId: "election-1",
    electoralZoneId: null, pollingPlaceId: null, categoryId: "category-1", createdById: null,
    assignedToId: null, assignedToName: null, openedAt: new Date(), resolvedAt: null, closedAt: null,
    slaDeadline: new Date(Date.now() + 60_000), isSimulated: false, simulationId: null,
    createdAt: new Date(), updatedAt: new Date(), category: { id: "category-1", active: true },
    election: { id: "election-1", name: "Pleito", year: 2026 }, electoralZone: null, pollingPlace: null,
    events: [], assignments: [], ...overrides,
  };
}

describe("IncidentsService", () => {
  it("cria incidente, calcula SLA e registra o primeiro evento", async () => {
    const created = incident();
    const tx = { incident: { create: vi.fn().mockResolvedValue(created) }, incidentEvent: { create: vi.fn().mockResolvedValue({}) } };
    const prisma = {
      election: { findUnique: vi.fn().mockResolvedValue({ id: "election-1" }) },
      incidentCategory: { findUnique: vi.fn().mockResolvedValue({ id: "category-1", active: true }) },
      electoralZone: { findUnique: vi.fn() }, pollingPlace: { findUnique: vi.fn() },
      incident: { count: vi.fn().mockResolvedValue(0) },
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaService;
    const service = new IncidentsService(prisma);
    await service.create({ title: "Falha de rede", description: "Sem conectividade", severity: IncidentSeverity.HIGH, electionId: "election-1", categoryId: "category-1" });
    const data = tx.incident.create.mock.calls[0][0].data;
    expect(data.code).toBe("INC-00001");
    expect(data.slaDeadline).toBeInstanceOf(Date);
    expect(data.slaDeadline.getTime()).toBeGreaterThan(Date.now() + 3 * 60 * 60 * 1000);
    expect(tx.incidentEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ type: "INCIDENT_CREATED" }) }));
  });

  it("muda o status e preserva a transição na timeline", async () => {
    const current = incident();
    const tx = { incident: { update: vi.fn().mockResolvedValue({ ...current, status: IncidentStatus.TRIAGED }) }, incidentEvent: { create: vi.fn().mockResolvedValue({}) } };
    const prisma = {
      incident: { findUnique: vi.fn().mockResolvedValue(current) },
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaService;
    const service = new IncidentsService(prisma);
    await service.changeStatus("incident-1", { status: IncidentStatus.TRIAGED });
    expect(tx.incident.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: IncidentStatus.TRIAGED }) }));
    expect(tx.incidentEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ metadata: { from: "NEW", to: "TRIAGED" } }) }));
  });

  it("rejeita transição inválida de incidente encerrado", async () => {
    const prisma = { incident: { findUnique: vi.fn().mockResolvedValue(incident({ status: IncidentStatus.CLOSED })) } } as unknown as PrismaService;
    await expect(new IncidentsService(prisma).changeStatus("incident-1", { status: IncidentStatus.NEW })).rejects.toBeInstanceOf(BadRequestException);
  });

  it("registra atribuição e encerra a atribuição anterior", async () => {
    const current = incident({ status: IncidentStatus.TRIAGED });
    const tx = {
      incident: { update: vi.fn().mockResolvedValue({ ...current, status: IncidentStatus.ASSIGNED }) },
      incidentAssignment: { updateMany: vi.fn().mockResolvedValue({ count: 1 }), create: vi.fn().mockResolvedValue({}) },
      incidentEvent: { create: vi.fn().mockResolvedValue({}) },
    };
    const prisma = { incident: { findUnique: vi.fn().mockResolvedValue(current) }, $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)) } as unknown as PrismaService;
    await new IncidentsService(prisma).assign("incident-1", { assignedToName: "Equipe Técnica", reason: "Plantão" });
    expect(tx.incidentAssignment.updateMany).toHaveBeenCalled();
    expect(tx.incidentAssignment.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ assignedToName: "Equipe Técnica" }) }));
    expect(tx.incidentEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ type: "ASSIGNED" }) }));
  });
});
