import { BadRequestException, ConflictException } from "@nestjs/common";
import { IncidentSeverity, IncidentStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "@eops/database";
import type { EventBus } from "@eops/event-bus";
import { IncidentsService } from "./incidents.service";

function incident(overrides: Record<string, unknown> = {}) {
  return {
    id: "incident-1", code: "INC-00001", title: "Falha de rede", description: "Sem conectividade",
    severity: IncidentSeverity.HIGH, status: IncidentStatus.NEW, electionId: "election-1",
    electoralZoneId: null, pollingPlaceId: null, categoryId: "category-1", createdById: null,
    assignedToId: null, assignedToName: null, openedAt: new Date(), resolvedAt: null, closedAt: null,
    acknowledgedAt: null, acknowledgedById: null, escalationLevel: 0, escalatedAt: null,
    escalatedById: null, escalationReason: null,
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
    expect(tx.incidentEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ metadata: expect.objectContaining({ from: "NEW", to: "TRIAGED" }) }) }));
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

  it("rejeita resolve pelo endpoint genérico de status", async () => {
    const prisma = {} as PrismaService;
    await expect(new IncidentsService(prisma).changeStatus("incident-1", { status: IncidentStatus.RESOLVED })).rejects.toBeInstanceOf(BadRequestException);
  });

  it("reconhece uma única vez, registra timeline e emite ator autenticado", async () => {
    const current = incident();
    const updated = incident({ acknowledgedAt: new Date(), acknowledgedById: "actor-1" });
    const tx = {
      incident: { update: vi.fn().mockResolvedValue(updated) },
      incidentEvent: { create: vi.fn().mockResolvedValue({}) },
    };
    const prisma = {
      incident: { findUnique: vi.fn().mockResolvedValue(current) },
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaService;
    const eventBus = { emit: vi.fn().mockResolvedValue(undefined) } as unknown as EventBus;
    await new IncidentsService(prisma, eventBus).acknowledge("incident-1", "actor-1");
    expect(tx.incident.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ acknowledgedById: "actor-1" }) }));
    expect(tx.incidentEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ type: "ACKNOWLEDGED", actorId: "actor-1" }) }));
    expect(eventBus.emit).toHaveBeenCalledWith("incident.acknowledged", expect.objectContaining({ actorId: "actor-1" }));
  });

  it("rejeita acknowledgement duplicado", async () => {
    const prisma = { incident: { findUnique: vi.fn().mockResolvedValue(incident({ acknowledgedAt: new Date() })) } } as unknown as PrismaService;
    await expect(new IncidentsService(prisma).acknowledge("incident-1", "actor-1")).rejects.toBeInstanceOf(ConflictException);
  });

  it("escala somente para nível superior e registra motivo", async () => {
    const current = incident({ escalationLevel: 1 });
    const updated = incident({ escalationLevel: 2, escalatedAt: new Date(), escalationReason: "Sem resposta" });
    const tx = {
      incident: { update: vi.fn().mockResolvedValue(updated) },
      incidentEvent: { create: vi.fn().mockResolvedValue({}) },
    };
    const prisma = {
      incident: { findUnique: vi.fn().mockResolvedValue(current) },
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaService;
    const eventBus = { emit: vi.fn().mockResolvedValue(undefined) } as unknown as EventBus;
    await new IncidentsService(prisma, eventBus).escalate("incident-1", { level: 2, reason: "Sem resposta" }, "actor-1");
    expect(tx.incidentEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ type: "ESCALATED", actorId: "actor-1" }) }));
    expect(eventBus.emit).toHaveBeenCalledWith("incident.escalated", expect.objectContaining({ from: 1, to: 2, reason: "Sem resposta" }));
  });

  it("rejeita escalonamento para o nível atual", async () => {
    const prisma = { incident: { findUnique: vi.fn().mockResolvedValue(incident({ escalationLevel: 2 })) } } as unknown as PrismaService;
    await expect(new IncidentsService(prisma).escalate("incident-1", { level: 2, reason: "Repetido" }, "actor-1")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("prioriza escalonamento antes de severidade e expõe as razões operacionais", async () => {
    const escalated = incident({ id: "incident-escalated", severity: IncidentSeverity.HIGH, escalationLevel: 1, openedAt: new Date("2026-10-04T10:00:00Z") });
    const critical = incident({ id: "incident-critical", severity: IncidentSeverity.CRITICAL, acknowledgedAt: new Date(), assignedToName: "Equipe", openedAt: new Date("2026-10-04T09:00:00Z") });
    const prisma = { incident: { findMany: vi.fn().mockResolvedValue([critical, escalated]) } } as unknown as PrismaService;
    const result = await new IncidentsService(prisma).queue({ page: 1, pageSize: 20 });
    expect(result.items.map((item) => item.id)).toEqual(["incident-escalated", "incident-critical"]);
    expect(result.items[0].priorityReasons).toContain("Escalado nível 1");
    expect(result.total).toBe(2);
  });

  it("mantém categoria histórica e publica somente a alteração administrativa", async () => {
    const category = { id: "category-1", key: "REDE", name: "Rede", description: null, active: true };
    const prisma = { incidentCategory: { findUnique: vi.fn().mockResolvedValue(category), update: vi.fn().mockResolvedValue({ ...category, active: false }) } } as unknown as PrismaService;
    const eventBus = { emit: vi.fn().mockResolvedValue(undefined) } as unknown as EventBus;
    const result = await new IncidentsService(prisma, eventBus).updateCategory("category-1", { active: false }, "actor-1");
    expect(result.active).toBe(false);
    expect(eventBus.emit).toHaveBeenCalledWith("incident.category_updated", expect.objectContaining({ actorId: "actor-1", changes: { active: { from: true, to: false } } }));
  });
});
