import { BadRequestException } from "@nestjs/common";
import { RiskImpact, RiskLevel, RiskProbability, RiskStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../../../../../packages/database/src";
import type { EventBus } from "../../../../../packages/event-bus/src";
import type { RiskCatalogService } from "./risk-catalog.service";
import type { RiskMitigationService } from "./risk-mitigation.service";
import { RiskService } from "./risk.service";
import type { RiskTimelineService } from "./risk-timeline.service";

function risk(overrides: Record<string, unknown> = {}) {
  return {
    id: "risk-1",
    code: "RSK-00001",
    title: "Queda de energia na Zona 76",
    description: "Histórico de oscilação no local.",
    electionId: "election-1",
    electoralZoneId: "zone-1",
    pollingPlaceId: null,
    categoryId: "category-1",
    ownerId: null,
    ownerName: "Coordenação",
    responsibleId: null,
    responsibleName: "Equipe de energia",
    probability: RiskProbability.HIGH,
    impact: RiskImpact.HIGH,
    score: 16,
    level: RiskLevel.CRITICAL,
    status: RiskStatus.IDENTIFIED,
    identifiedAt: new Date("2026-10-01T10:00:00.000Z"),
    dueDate: null,
    acceptedAt: null,
    closedAt: null,
    materializedAt: null,
    actualImpact: null,
    materializationNotes: null,
    incidentId: null,
    observations: null,
    mitigationCount: 0,
    createdAt: new Date("2026-10-01T10:00:00.000Z"),
    updatedAt: new Date("2026-10-01T10:00:00.000Z"),
    election: { id: "election-1", name: "Eleições 2026", year: 2026 },
    electoralZone: { id: "zone-1", number: 76, name: "Centro" },
    pollingPlace: null,
    category: { id: "category-1", key: "POWER", name: "Energia" },
    mitigations: [],
    events: [],
    ...overrides,
  };
}

function serviceFor(prisma: Record<string, unknown>, eventBus?: Partial<EventBus>) {
  const catalog = {
    require: vi.fn().mockResolvedValue({ id: "category-1", active: true }),
    list: vi.fn().mockResolvedValue([]),
  } as unknown as RiskCatalogService;
  const mitigations = {
    present: vi.fn().mockImplementation((rows: unknown[]) =>
      rows.map((row) => ({ ...(row as object), overdue: false })),
    ),
    replaceWithin: vi.fn().mockResolvedValue({ added: 0, removed: 0, completed: 0 }),
    countOverdue: vi.fn().mockResolvedValue(new Map()),
  } as unknown as RiskMitigationService;
  const timeline = {
    record: vi.fn().mockResolvedValue({}),
    dataFor: vi.fn().mockImplementation((riskId: string, entry: unknown) => ({
      riskId,
      ...(entry as object),
    })),
    list: vi.fn().mockResolvedValue([]),
  } as unknown as RiskTimelineService;

  return new RiskService(
    prisma as unknown as PrismaService,
    catalog,
    mitigations,
    timeline,
    eventBus as EventBus,
  );
}

describe("RiskService.create", () => {
  it("calcula score e classificação no servidor", async () => {
    const tx = {
      risk: { create: vi.fn().mockResolvedValue(risk()) },
      riskEvent: { create: vi.fn().mockResolvedValue({}) },
    };
    const prisma = {
      riskCategory: { findUnique: vi.fn().mockResolvedValue({ id: "category-1", active: true }) },
      election: { findUnique: vi.fn().mockResolvedValue({ id: "election-1" }) },
      electoralZone: { findUnique: vi.fn().mockResolvedValue({ id: "zone-1", electionId: "election-1" }) },
      pollingPlace: { findUnique: vi.fn() },
      risk: {
        findFirst: vi.fn().mockResolvedValue({ code: "RSK-00041" }),
        findUnique: vi.fn().mockResolvedValue(risk()),
      },
      user: { findUnique: vi.fn().mockResolvedValue({ name: "Coordenação" }) },
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const emit = vi.fn().mockResolvedValue(undefined);

    await serviceFor(prisma, { emit } as unknown as Partial<EventBus>).create(
      {
        title: "Queda de energia",
        description: "Histórico de oscilação.",
        electionId: "election-1",
        electoralZoneId: "zone-1",
        categoryId: "category-1",
        ownerName: "Coordenação",
        responsibleName: "Equipe de energia",
        probability: RiskProbability.HIGH,
        impact: RiskImpact.HIGH,
      },
      { id: "user-1" },
    );

    const data = tx.risk.create.mock.calls[0][0].data;
    expect(data.code).toBe("RSK-00042");
    expect(data.score).toBe(16);
    expect(data.level).toBe(RiskLevel.CRITICAL);
    expect(tx.riskEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: "CREATED" }),
      }),
    );
    expect(emit).toHaveBeenCalledWith(
      "risk.created",
      expect.objectContaining({ score: 16, level: RiskLevel.CRITICAL }),
    );
  });

  it("rejeita zona de outro pleito", async () => {
    const prisma = {
      riskCategory: { findUnique: vi.fn().mockResolvedValue({ id: "category-1", active: true }) },
      election: { findUnique: vi.fn().mockResolvedValue({ id: "election-1" }) },
      electoralZone: {
        findUnique: vi.fn().mockResolvedValue({ id: "zone-9", electionId: "election-9" }),
      },
      pollingPlace: { findUnique: vi.fn() },
    };
    await expect(
      serviceFor(prisma).create({
        title: "Risco",
        description: "Descrição",
        electionId: "election-1",
        electoralZoneId: "zone-9",
        categoryId: "category-1",
        ownerName: "Dono",
        responsibleName: "Responsável",
        probability: RiskProbability.LOW,
        impact: RiskImpact.LOW,
      }),
    ).rejects.toThrow("não pertence ao pleito");
  });
});

describe("RiskService.update", () => {
  function prismaFor(current: Record<string, unknown>, updated: Record<string, unknown>) {
    const tx = {
      risk: { update: vi.fn().mockResolvedValue({}) },
      riskEvent: { create: vi.fn().mockResolvedValue({}) },
    };
    return {
      tx,
      prisma: {
        risk: {
          findUnique: vi.fn().mockResolvedValueOnce(current).mockResolvedValue(updated),
        },
        riskCategory: { findUnique: vi.fn().mockResolvedValue({ id: "category-1", active: true }) },
        election: { findUnique: vi.fn().mockResolvedValue({ id: "election-1" }) },
        electoralZone: { findUnique: vi.fn() },
        pollingPlace: { findUnique: vi.fn() },
        user: { findUnique: vi.fn().mockResolvedValue({ name: "Coordenação" }) },
        $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
      },
    };
  }

  it("recalcula score e registra a alteração no histórico", async () => {
    const { prisma, tx } = prismaFor(risk(), risk({ score: 25, level: RiskLevel.CRITICAL }));
    await serviceFor(prisma).update("risk-1", {
      probability: RiskProbability.VERY_HIGH,
      impact: RiskImpact.VERY_HIGH,
    });

    const data = tx.risk.update.mock.calls[0][0].data;
    expect(data.score).toBe(25);
    expect(data.level).toBe(RiskLevel.CRITICAL);
    expect(tx.riskEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "SCORE_CHANGED",
          metadata: { fromScore: 16, toScore: 25, fromLevel: "CRITICAL", toLevel: "CRITICAL" },
        }),
      }),
    );
  });

  it("move para ASSESSED na primeira avaliação", async () => {
    const current = risk({ status: RiskStatus.IDENTIFIED, score: 9, level: RiskLevel.MODERATE });
    const { prisma, tx } = prismaFor(current, risk({ status: RiskStatus.ASSESSED }));
    await serviceFor(prisma).update("risk-1", { probability: RiskProbability.HIGH });

    expect(tx.risk.update.mock.calls[0][0].data.status).toBe(RiskStatus.ASSESSED);
  });

  it("emite escalonamento ao subir de faixa", async () => {
    const current = risk({ score: 4, level: RiskLevel.LOW });
    const { prisma } = prismaFor(current, risk({ score: 16, level: RiskLevel.CRITICAL }));
    const emit = vi.fn().mockResolvedValue(undefined);

    await serviceFor(prisma, { emit } as unknown as Partial<EventBus>).update("risk-1", {
      probability: RiskProbability.HIGH,
      impact: RiskImpact.HIGH,
    });

    expect(emit).toHaveBeenCalledWith(
      "risk.escalated",
      expect.objectContaining({ fromLevel: RiskLevel.LOW, toLevel: RiskLevel.CRITICAL }),
    );
  });

  it("não emite escalonamento quando a faixa não sobe", async () => {
    const { prisma } = prismaFor(risk(), risk({ score: 12, level: RiskLevel.HIGH }));
    const emit = vi.fn().mockResolvedValue(undefined);
    await serviceFor(prisma, { emit } as unknown as Partial<EventBus>).update("risk-1", {
      probability: RiskProbability.MEDIUM,
    });
    expect(emit).not.toHaveBeenCalled();
  });

  it("recusa transição de encerrado para outro estado", async () => {
    const current = risk({ status: RiskStatus.CLOSED });
    const prisma = { risk: { findUnique: vi.fn().mockResolvedValue(current) } };
    await expect(
      serviceFor(prisma).update("risk-1", { status: RiskStatus.MITIGATING }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe("RiskService.materialize", () => {
  it("registra impacto real, data e emite o evento", async () => {
    const current = risk();
    const tx = {
      risk: { update: vi.fn().mockResolvedValue({}) },
      riskEvent: { create: vi.fn().mockResolvedValue({}) },
    };
    const prisma = {
      risk: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce(current)
          .mockResolvedValue(risk({ status: RiskStatus.MATERIALIZED })),
      },
      incident: { findUnique: vi.fn().mockResolvedValue({ id: "incident-1", code: "INC-00001" }) },
      user: { findUnique: vi.fn().mockResolvedValue({ name: "Coordenação" }) },
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const emit = vi.fn().mockResolvedValue(undefined);

    await serviceFor(prisma, { emit } as unknown as Partial<EventBus>).materialize(
      "risk-1",
      { actualImpact: "Local ficou 40 minutos sem energia.", incidentId: "incident-1" },
      { id: "user-1" },
    );

    const data = tx.risk.update.mock.calls[0][0].data;
    expect(data.status).toBe(RiskStatus.MATERIALIZED);
    expect(data.actualImpact).toContain("40 minutos");
    expect(data.incidentId).toBe("incident-1");
    expect(data.materializedAt).toBeInstanceOf(Date);
    expect(emit).toHaveBeenCalledWith(
      "risk.materialized",
      expect.objectContaining({ incidentId: "incident-1" }),
    );
  });

  it("recusa materializar duas vezes", async () => {
    const prisma = {
      risk: {
        findUnique: vi.fn().mockResolvedValue(risk({ status: RiskStatus.MATERIALIZED })),
      },
    };
    await expect(
      serviceFor(prisma).materialize("risk-1", { actualImpact: "Já aconteceu" }),
    ).rejects.toThrow("já foi registrado como materializado");
  });

  it("recusa materializar risco encerrado", async () => {
    const prisma = {
      risk: { findUnique: vi.fn().mockResolvedValue(risk({ status: RiskStatus.CLOSED })) },
    };
    await expect(
      serviceFor(prisma).materialize("risk-1", { actualImpact: "Impacto" }),
    ).rejects.toThrow("encerrados não podem ser materializados");
  });

  it("rejeita incidente inexistente", async () => {
    const prisma = {
      risk: { findUnique: vi.fn().mockResolvedValue(risk()) },
      incident: { findUnique: vi.fn().mockResolvedValue(null) },
    };
    await expect(
      serviceFor(prisma).materialize("risk-1", {
        actualImpact: "Impacto real",
        incidentId: "incidente-fantasma",
      }),
    ).rejects.toThrow("Incidente informado não encontrado");
  });
});

describe("RiskService.close", () => {
  it("encerra, registra histórico e emite evento", async () => {
    const tx = {
      risk: { update: vi.fn().mockResolvedValue({}) },
      riskEvent: { create: vi.fn().mockResolvedValue({}) },
    };
    const prisma = {
      risk: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce(risk())
          .mockResolvedValue(risk({ status: RiskStatus.CLOSED, closedAt: new Date() })),
      },
      user: { findUnique: vi.fn().mockResolvedValue({ name: "Coordenação" }) },
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const emit = vi.fn().mockResolvedValue(undefined);

    await serviceFor(prisma, { emit } as unknown as Partial<EventBus>).close("risk-1");

    expect(tx.risk.update.mock.calls[0][0].data.status).toBe(RiskStatus.CLOSED);
    expect(emit).toHaveBeenCalledWith(
      "risk.closed",
      expect.objectContaining({ code: "RSK-00001" }),
    );
  });

  it("é idempotente quando já encerrado", async () => {
    const prisma = {
      risk: {
        findUnique: vi.fn().mockResolvedValue(risk({ status: RiskStatus.CLOSED })),
      },
      $transaction: vi.fn(),
    };
    await serviceFor(prisma).close("risk-1");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe("RiskService.remove", () => {
  it("exclui risco identificado sem plano de mitigação", async () => {
    const remove = vi.fn().mockResolvedValue({});
    const prisma = {
      risk: { findUnique: vi.fn().mockResolvedValue(risk()), delete: remove },
    };
    await serviceFor(prisma).remove("risk-1");
    expect(remove).toHaveBeenCalledWith({ where: { id: "risk-1" } });
  });

  it("recusa excluir risco já tratado", async () => {
    const prisma = {
      risk: {
        findUnique: vi.fn().mockResolvedValue(risk({ status: RiskStatus.MITIGATING })),
      },
    };
    await expect(serviceFor(prisma).remove("risk-1")).rejects.toThrow("não tratados");
  });

  it("recusa excluir risco com mitigações", async () => {
    const prisma = {
      risk: {
        findUnique: vi.fn().mockResolvedValue(
          risk({ mitigations: [{ id: "m1", status: "PLANNED", progress: 0, dueDate: null }], mitigationCount: 1 }),
        ),
      },
    };
    await expect(serviceFor(prisma).remove("risk-1")).rejects.toThrow("plano de mitigação");
  });
});

describe("RiskService.findAll", () => {
  it("aplica filtros de classificação, período, matriz e busca", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const prisma = { risk: { findMany, count: vi.fn().mockResolvedValue(0) } };
    await serviceFor(prisma).findAll({
      level: RiskLevel.CRITICAL,
      from: "2026-10-01T00:00:00.000Z",
      matrixProbability: RiskProbability.HIGH,
      matrixImpact: RiskImpact.VERY_HIGH,
      search: "energia",
      page: 2,
      pageSize: 10,
    });

    const args = findMany.mock.calls[0][0];
    expect(args.where.level).toBe(RiskLevel.CRITICAL);
    expect(args.where.probability).toBe(RiskProbability.HIGH);
    expect(args.where.impact).toBe(RiskImpact.VERY_HIGH);
    expect(args.where.identifiedAt.gte).toBeInstanceOf(Date);
    expect(args.where.OR).toHaveLength(5);
    expect(args.skip).toBe(10);
    expect(args.orderBy[0]).toEqual({ level: "desc" });
  });

  it("filtra riscos sem mitigação", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const prisma = { risk: { findMany, count: vi.fn().mockResolvedValue(0) } };
    await serviceFor(prisma).findAll({ withoutMitigation: true, page: 1, pageSize: 20 });
    expect(findMany.mock.calls[0][0].where.mitigations).toEqual({ none: {} });
  });

  it("filtra riscos com mitigação atrasada considerando apenas ações abertas", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const prisma = { risk: { findMany, count: vi.fn().mockResolvedValue(0) } };
    await serviceFor(prisma).findAll({ withOverdueMitigation: true, page: 1, pageSize: 20 });
    const filter = findMany.mock.calls[0][0].where.mitigations.some;
    expect(filter.dueDate.lt).toBeInstanceOf(Date);
    expect(filter.status.notIn).toEqual(["COMPLETED", "CANCELLED"]);
  });
});

describe("RiskService.dashboard", () => {
  it("ordena as classificações da mais grave para a menos grave", async () => {
    const prisma = {
      risk: {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
        groupBy: vi
          .fn()
          .mockResolvedValueOnce([
            { level: RiskLevel.LOW, _count: { _all: 3 } },
            { level: RiskLevel.CRITICAL, _count: { _all: 1 } },
          ])
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([]),
        aggregate: vi.fn().mockResolvedValue({ _avg: { score: 12.34 } }),
      },
      riskMitigation: { count: vi.fn().mockResolvedValue(2) },
      riskCategory: { findMany: vi.fn().mockResolvedValue([]) },
      electoralZone: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const dashboard = await serviceFor(prisma).dashboard();
    expect(dashboard.byLevel[0].key).toBe(RiskLevel.CRITICAL);
    expect(dashboard.overdueMitigations).toBe(2);
    expect(dashboard.averageScore).toBe(12.3);
    expect(dashboard.matrix).toHaveLength(5);
  });
});
