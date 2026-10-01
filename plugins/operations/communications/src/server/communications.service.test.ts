import { BadRequestException } from "@nestjs/common";
import {
  CommunicationPriority,
  CommunicationStatus,
} from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../../../../../packages/database/src";
import type { EventBus } from "../../../../../packages/event-bus/src";
import type { CommunicationMetricsService } from "./communication-metrics.service";
import type { CommunicationRecipientsService } from "./communication-recipients.service";
import type { CommunicationTemplatesService } from "./communication-templates.service";
import type { CommunicationTimelineService } from "./communication-timeline.service";
import { CommunicationsService } from "./communications.service";

function communication(overrides: Record<string, unknown> = {}) {
  return {
    id: "communication-1",
    code: "COM-00001",
    title: "Retomada da transmissão",
    content: "A transmissão da Zona 76 será retomada às 18h.",
    priority: CommunicationPriority.HIGH,
    status: CommunicationStatus.DRAFT,
    electionId: "election-1",
    categoryId: null,
    authorId: "user-1",
    authorName: "Coordenação",
    observations: null,
    scheduledAt: null,
    publishedAt: null,
    dispatchedAt: null,
    expiresAt: null,
    archivedAt: null,
    cancelledAt: null,
    recipientCount: 0,
    createdAt: new Date("2026-10-01T10:00:00.000Z"),
    updatedAt: new Date("2026-10-01T10:00:00.000Z"),
    election: { id: "election-1", name: "Eleições 2026", year: 2026 },
    category: null,
    tags: [],
    audiences: [],
    ...overrides,
  };
}

function serviceFor(prisma: Record<string, unknown>, eventBus?: Partial<EventBus>) {
  const timeline = {
    record: vi.fn().mockResolvedValue({}),
    dataFor: vi.fn().mockImplementation((communicationId: string, entry: unknown) => ({
      communicationId,
      ...(entry as object),
    })),
    list: vi.fn().mockResolvedValue([]),
  } as unknown as CommunicationTimelineService;
  const recipients = {
    sync: vi.fn().mockResolvedValue({ created: 3, removed: 0, total: 3 }),
    dispatch: vi.fn().mockResolvedValue(3),
  } as unknown as CommunicationRecipientsService;
  const metrics = {
    forCommunication: vi.fn().mockResolvedValue({
      total: 0,
      delivered: 0,
      viewed: 0,
      confirmed: 0,
      pending: 0,
      deliveryRate: 0,
      readRate: 0,
      confirmationRate: 0,
    }),
    forCommunications: vi.fn().mockResolvedValue(new Map()),
    dashboard: vi.fn(),
  } as unknown as CommunicationMetricsService;
  const templates = {
    tagLinksFor: vi.fn().mockResolvedValue([]),
    listCategories: vi.fn().mockResolvedValue([]),
    listTemplates: vi.fn().mockResolvedValue([]),
    listTags: vi.fn().mockResolvedValue([]),
  } as unknown as CommunicationTemplatesService;
  return new CommunicationsService(
    prisma as unknown as PrismaService,
    timeline,
    recipients,
    metrics,
    templates,
    eventBus as EventBus,
  );
}

describe("CommunicationsService.create", () => {
  it("gera código sequencial, autor e evento inicial", async () => {
    const tx = {
      communication: { create: vi.fn().mockResolvedValue(communication()) },
      communicationEvent: { create: vi.fn().mockResolvedValue({}) },
    };
    const prisma = {
      election: { findUnique: vi.fn().mockResolvedValue({ id: "election-1" }) },
      communication: { findFirst: vi.fn().mockResolvedValue({ code: "COM-00041" }) },
      user: { findUnique: vi.fn().mockResolvedValue({ name: "Coordenação" }) },
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    await serviceFor(prisma).create(
      {
        title: "Retomada da transmissão",
        content: "Conteúdo operacional",
        electionId: "election-1",
        tags: [],
        audiences: [{ type: "ALL" }],
      },
      { id: "user-1" },
    );

    const data = tx.communication.create.mock.calls[0][0].data;
    expect(data.code).toBe("COM-00042");
    expect(data.authorName).toBe("Coordenação");
    expect(data.status).toBeUndefined();
    expect(tx.communicationEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: "CREATED" }),
      }),
    );
  });

  it("rejeita pleito inexistente", async () => {
    const prisma = { election: { findUnique: vi.fn().mockResolvedValue(null) } };
    await expect(
      serviceFor(prisma).create({
        title: "Título válido",
        content: "Conteúdo válido",
        electionId: "inexistente",
        tags: [],
        audiences: [],
      }),
    ).rejects.toThrow("Pleito não encontrado.");
  });

  it("rejeita categoria inativa", async () => {
    const prisma = {
      election: { findUnique: vi.fn().mockResolvedValue({ id: "election-1" }) },
      communicationCategory: {
        findUnique: vi.fn().mockResolvedValue({ id: "category-1", active: false }),
      },
    };
    await expect(
      serviceFor(prisma).create({
        title: "Título válido",
        content: "Conteúdo válido",
        electionId: "election-1",
        categoryId: "category-1",
        tags: [],
        audiences: [],
      }),
    ).rejects.toThrow("Categoria de comunicado não encontrada ou inativa.");
  });

  it("rejeita direcionamento com alvo inexistente", async () => {
    const prisma = {
      election: { findUnique: vi.fn().mockResolvedValue({ id: "election-1" }) },
      electoralZone: { count: vi.fn().mockResolvedValue(0) },
      pollingPlace: { count: vi.fn().mockResolvedValue(0) },
      fieldTeam: { count: vi.fn().mockResolvedValue(0) },
      fieldRole: { count: vi.fn().mockResolvedValue(0) },
      user: { count: vi.fn().mockResolvedValue(0) },
    };
    await expect(
      serviceFor(prisma).create({
        title: "Título válido",
        content: "Conteúdo válido",
        electionId: "election-1",
        tags: [],
        audiences: [{ type: "ELECTORAL_ZONE", electoralZoneId: "zona-fantasma" }],
      }),
    ).rejects.toThrow("zona eleitoral");
  });
});

describe("CommunicationsService.publish", () => {
  function prismaFor(status: CommunicationStatus, audiences: unknown[]) {
    const current = communication({ status, audiences });
    const tx = {
      communication: { update: vi.fn().mockResolvedValue({}) },
      communicationEvent: { createMany: vi.fn().mockResolvedValue({ count: 2 }) },
    };
    return {
      current,
      tx,
      prisma: {
        communication: {
          findUnique: vi
            .fn()
            .mockResolvedValueOnce(current)
            .mockResolvedValue({
              ...current,
              status: CommunicationStatus.PUBLISHED,
              publishedAt: new Date(),
            }),
          findMany: vi.fn().mockResolvedValue([]),
        },
        communicationRecipient: { groupBy: vi.fn().mockResolvedValue([]) },
        user: { findUnique: vi.fn().mockResolvedValue({ name: "Coordenação" }) },
        $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
      },
    };
  }

  it("exige direcionamento antes de publicar", async () => {
    const { prisma } = prismaFor(CommunicationStatus.DRAFT, []);
    await expect(serviceFor(prisma).publish("communication-1", {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("recusa publicar comunicado cancelado", async () => {
    const { prisma } = prismaFor(CommunicationStatus.CANCELLED, [{ id: "audience-1" }]);
    await expect(serviceFor(prisma).publish("communication-1", {})).rejects.toThrow(
      "não permitida",
    );
  });

  it("publica, materializa destinatários e emite o evento de domínio", async () => {
    const { prisma, tx } = prismaFor(CommunicationStatus.DRAFT, [{ id: "audience-1" }]);
    const emit = vi.fn().mockResolvedValue(undefined);
    const service = serviceFor(prisma, { emit } as unknown as Partial<EventBus>);

    await service.publish("communication-1", {}, { id: "user-1" });

    expect(tx.communication.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: CommunicationStatus.PUBLISHED }),
      }),
    );
    const eventTypes = tx.communicationEvent.createMany.mock.calls[0][0].data.map(
      (row: { type: string }) => row.type,
    );
    expect(eventTypes).toEqual(["PUBLISHED", "DISPATCHED"]);
    expect(emit).toHaveBeenCalledWith(
      "communication.published",
      expect.objectContaining({ entityId: "communication-1", recipientCount: 3 }),
    );
  });

  it("é idempotente quando já está publicado", async () => {
    const { prisma, tx } = prismaFor(CommunicationStatus.PUBLISHED, [{ id: "audience-1" }]);
    const service = serviceFor(prisma);

    await service.publish("communication-1", {});

    expect(tx.communication.update).not.toHaveBeenCalled();
    expect(tx.communicationEvent.createMany).not.toHaveBeenCalled();
  });
});

describe("CommunicationsService.cancel", () => {
  it("registra motivo, data e evento", async () => {
    const current = communication({ status: CommunicationStatus.PUBLISHED });
    const tx = {
      communication: { update: vi.fn().mockResolvedValue({}) },
      communicationEvent: { create: vi.fn().mockResolvedValue({}) },
    };
    const prisma = {
      communication: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce(current)
          .mockResolvedValue({ ...current, status: CommunicationStatus.CANCELLED }),
        findMany: vi.fn().mockResolvedValue([]),
      },
      communicationRecipient: { groupBy: vi.fn().mockResolvedValue([]) },
      user: { findUnique: vi.fn().mockResolvedValue({ name: "Coordenação" }) },
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const emit = vi.fn().mockResolvedValue(undefined);
    await serviceFor(prisma, { emit } as unknown as Partial<EventBus>).cancel(
      "communication-1",
      { reason: "Informação incorreta" },
    );

    expect(tx.communication.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: CommunicationStatus.CANCELLED,
          cancelledAt: expect.any(Date),
        }),
      }),
    );
    expect(tx.communicationEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "CANCELLED",
          message: "Informação incorreta",
        }),
      }),
    );
    expect(emit).toHaveBeenCalledWith(
      "communication.cancelled",
      expect.objectContaining({ code: "COM-00001" }),
    );
  });

  it("recusa cancelar comunicado já arquivado", async () => {
    const prisma = {
      communication: {
        findUnique: vi
          .fn()
          .mockResolvedValue(communication({ status: CommunicationStatus.ARCHIVED })),
      },
    };
    await expect(
      serviceFor(prisma).cancel("communication-1", {}),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe("CommunicationsService.remove", () => {
  it("exclui rascunho nunca publicado", async () => {
    const remove = vi.fn().mockResolvedValue({});
    const prisma = {
      communication: {
        findUnique: vi.fn().mockResolvedValue(communication()),
        delete: remove,
      },
    };
    await serviceFor(prisma).remove("communication-1");
    expect(remove).toHaveBeenCalledWith({ where: { id: "communication-1" } });
  });

  it("preserva comunicado publicado para auditoria", async () => {
    const prisma = {
      communication: {
        findUnique: vi.fn().mockResolvedValue(
          communication({
            status: CommunicationStatus.PUBLISHED,
            publishedAt: new Date(),
          }),
        ),
      },
    };
    await expect(serviceFor(prisma).remove("communication-1")).rejects.toThrow(
      "não podem ser excluídos",
    );
  });
});

describe("CommunicationsService.findAll", () => {
  it("aplica filtros de prioridade, período e busca", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const prisma = {
      communication: {
        findMany,
        count: vi.fn().mockResolvedValue(0),
      },
      communicationRecipient: { groupBy: vi.fn().mockResolvedValue([]) },
    };
    // Primeira chamada: varredura de expiração (nenhum vencido). Segunda: a lista.
    const service = serviceFor(prisma);
    await service.findAll({
      urgentOnly: true,
      from: "2026-10-01T00:00:00.000Z",
      search: "transmissão",
      page: 2,
      pageSize: 10,
    });

    const args = findMany.mock.calls[1][0];
    expect(args.where.priority).toEqual({ in: ["HIGH", "CRITICAL"] });
    expect(args.where.createdAt.gte).toBeInstanceOf(Date);
    expect(args.where.OR).toHaveLength(4);
    expect(args.skip).toBe(10);
    expect(args.take).toBe(10);
    expect(args.orderBy).toEqual([{ priority: "desc" }, { createdAt: "desc" }]);
  });

  it("expira comunicados publicados com prazo vencido e emite evento", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const prisma = {
      communication: {
        findMany: vi.fn().mockResolvedValueOnce([
          { id: "communication-9", code: "COM-00009", title: "Aviso antigo" },
        ]).mockResolvedValueOnce([]),
        count: vi.fn().mockResolvedValue(0),
        updateMany,
      },
      communicationRecipient: { groupBy: vi.fn().mockResolvedValue([]) },
    };
    const emit = vi.fn().mockResolvedValue(undefined);
    await serviceFor(prisma, { emit } as unknown as Partial<EventBus>).findAll({
      page: 1,
      pageSize: 20,
    });

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "communication-9", status: CommunicationStatus.PUBLISHED },
      data: { status: CommunicationStatus.EXPIRED },
    });
    expect(emit).toHaveBeenCalledWith(
      "communication.expired",
      expect.objectContaining({ entityId: "communication-9" }),
    );
  });
});
