import { BadRequestException } from "@nestjs/common";
import {
  CommunicationAudienceType,
  CommunicationDeliveryStatus,
  CommunicationPriority,
  CommunicationStatus,
} from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "@eops/database";
import type { EventBus } from "@eops/event-bus";
import { CommunicationRecipientsService } from "./communication-recipients.service";
import type { CommunicationTimelineService } from "./communication-timeline.service";

function timelineMock() {
  return {
    record: vi.fn().mockResolvedValue({}),
    dataFor: vi.fn(),
    list: vi.fn().mockResolvedValue([]),
  } as unknown as CommunicationTimelineService;
}

function serviceFor(prisma: Record<string, unknown>, eventBus?: Partial<EventBus>) {
  return new CommunicationRecipientsService(
    prisma as unknown as PrismaService,
    timelineMock(),
    eventBus as EventBus,
  );
}

const audienceRow = {
  id: "audience-1",
  type: CommunicationAudienceType.FIELD_TEAM,
  electoralZoneId: null,
  pollingPlaceId: null,
  fieldTeamId: "team-1",
  fieldRoleId: null,
  userId: null,
  electoralZone: null,
  pollingPlace: null,
  fieldTeam: { name: "Equipe Alfa" },
  fieldRole: null,
  user: null,
};

describe("resolução de destinatários", () => {
  it("resolve membros da equipe e descreve a origem", async () => {
    const prisma = {
      communicationAudience: { findMany: vi.fn().mockResolvedValue([audienceRow]) },
      fieldMember: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "member-1",
            name: "Carlos Nunes",
            email: "carlos@eops.local",
            role: { name: "Técnico" },
            team: { name: "Equipe Alfa" },
          },
        ]),
      },
    };
    const [candidate] = await serviceFor(prisma).resolve("communication-1");
    expect(candidate.dedupeKey).toBe("member:member-1");
    expect(candidate.memberId).toBe("member-1");
    expect(candidate.roleLabel).toBe("Técnico");
    expect(candidate.sourceLabel).toContain("Equipe Alfa");
  });

  it("deduplica a mesma pessoa alcançada por regras diferentes", async () => {
    const member = {
      id: "member-1",
      name: "Carlos Nunes",
      email: null,
      role: { name: "Técnico" },
      team: { name: "Equipe Alfa" },
    };
    const prisma = {
      communicationAudience: {
        findMany: vi.fn().mockResolvedValue([
          audienceRow,
          { ...audienceRow, id: "audience-2", fieldTeamId: "team-2" },
        ]),
      },
      fieldMember: { findMany: vi.fn().mockResolvedValue([member]) },
    };
    const candidates = await serviceFor(prisma).resolve("communication-1");
    expect(candidates).toHaveLength(1);
  });

  it("resolve usuários ativos quando o direcionamento é ALL", async () => {
    const prisma = {
      communicationAudience: {
        findMany: vi
          .fn()
          .mockResolvedValue([{ ...audienceRow, type: CommunicationAudienceType.ALL, fieldTeamId: null }]),
      },
      user: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "user-1",
            name: "Administrador Demo",
            email: "admin@eops.local",
            roles: [{ role: { name: "Administrador" } }],
          },
        ]),
      },
      fieldMember: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const candidates = await serviceFor(prisma).resolve("communication-1");
    expect(candidates).toHaveLength(1);
    expect(candidates[0].dedupeKey).toBe("user:user-1");
    expect(candidates[0].roleLabel).toBe("Administrador");
  });

  it("resolve por zona combinando escalas e alocações vigentes", async () => {
    const prisma = {
      communicationAudience: {
        findMany: vi.fn().mockResolvedValue([
          {
            ...audienceRow,
            type: CommunicationAudienceType.ELECTORAL_ZONE,
            fieldTeamId: null,
            electoralZoneId: "zone-1",
          },
        ]),
      },
      fieldShift: {
        findMany: vi.fn().mockResolvedValue([{ memberId: "member-1" }, { memberId: "member-2" }]),
      },
      fieldAllocation: { findMany: vi.fn().mockResolvedValue([{ memberId: "member-2" }]) },
      fieldMember: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "member-1",
            name: "Ana",
            email: null,
            role: { name: "Coordenador" },
            team: { name: "Alfa" },
          },
        ]),
      },
    };
    await serviceFor(prisma).resolve("communication-1");

    const where = (prisma.fieldMember.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0].where;
    expect(where.OR[0].id.in).toEqual(["member-1", "member-2"]);
  });
});

describe("markRead", () => {
  function recipient(overrides: Record<string, unknown> = {}) {
    return {
      id: "recipient-1",
      communicationId: "communication-1",
      name: "Carlos Nunes",
      userId: "user-1",
      deliveredAt: new Date("2026-10-01T10:00:00.000Z"),
      viewedAt: null,
      confirmedAt: null,
      deliveryStatus: CommunicationDeliveryStatus.DELIVERED,
      communication: {
        id: "communication-1",
        code: "COM-00001",
        title: "Comunicado",
        status: CommunicationStatus.PUBLISHED,
        priority: CommunicationPriority.NORMAL,
      },
      ...overrides,
    };
  }

  it("avança de entregue para lido e emite evento apenas na primeira leitura", async () => {
    const update = vi.fn().mockImplementation(({ data }) => ({ ...recipient(), ...data }));
    const prisma = {
      communicationRecipient: {
        findUnique: vi.fn().mockResolvedValue(recipient()),
        update,
      },
    };
    const emit = vi.fn().mockResolvedValue(undefined);
    const service = serviceFor(prisma, { emit } as unknown as Partial<EventBus>);

    await service.markRead("communication-1", "recipient-1");
    expect(update.mock.calls[0][0].data.deliveryStatus).toBe(CommunicationDeliveryStatus.VIEWED);
    expect(update.mock.calls[0][0].data.viewedAt).toBeInstanceOf(Date);
    expect(emit).toHaveBeenCalledWith(
      "communication.read",
      expect.objectContaining({ communicationId: "communication-1" }),
    );
  });

  it("não rebaixa quem já confirmou nem reemite evento", async () => {
    const alreadyViewed = recipient({
      viewedAt: new Date("2026-10-01T10:05:00.000Z"),
      confirmedAt: new Date("2026-10-01T10:06:00.000Z"),
      deliveryStatus: CommunicationDeliveryStatus.CONFIRMED,
    });
    const update = vi.fn().mockResolvedValue(alreadyViewed);
    const prisma = {
      communicationRecipient: {
        findUnique: vi.fn().mockResolvedValue(alreadyViewed),
        update,
      },
    };
    const emit = vi.fn().mockResolvedValue(undefined);
    await serviceFor(prisma, { emit } as unknown as Partial<EventBus>).markRead(
      "communication-1",
      "recipient-1",
    );

    expect(update.mock.calls[0][0].data.deliveryStatus).toBe(CommunicationDeliveryStatus.CONFIRMED);
    expect(emit).not.toHaveBeenCalled();
  });

  it("recusa registrar leitura de comunicado não publicado", async () => {
    const prisma = {
      communicationRecipient: {
        findUnique: vi.fn().mockResolvedValue(
          recipient({
            communication: {
              id: "communication-1",
              code: "COM-00001",
              title: "Rascunho",
              status: CommunicationStatus.DRAFT,
              priority: CommunicationPriority.NORMAL,
            },
          }),
        ),
      },
    };
    await expect(
      serviceFor(prisma).markRead("communication-1", "recipient-1"),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("recusa destinatário de outro comunicado", async () => {
    const prisma = {
      communicationRecipient: {
        findUnique: vi.fn().mockResolvedValue(recipient({ communicationId: "communication-9" })),
      },
    };
    await expect(
      serviceFor(prisma).markRead("communication-1", "recipient-1"),
    ).rejects.toThrow("não encontrado neste comunicado");
  });
});

describe("confirm", () => {
  it("preenche os três carimbos e emite confirmação", async () => {
    const current = {
      id: "recipient-1",
      communicationId: "communication-1",
      name: "Carlos Nunes",
      userId: "user-1",
      deliveredAt: null,
      viewedAt: null,
      confirmedAt: null,
      confirmationNote: null,
      deliveryStatus: CommunicationDeliveryStatus.PENDING,
      communication: {
        id: "communication-1",
        code: "COM-00001",
        title: "Comunicado",
        status: CommunicationStatus.PUBLISHED,
        priority: CommunicationPriority.CRITICAL,
      },
    };
    const update = vi.fn().mockImplementation(({ data }) => ({ ...current, ...data }));
    const prisma = {
      communicationRecipient: {
        findUnique: vi.fn().mockResolvedValue(current),
        update,
      },
    };
    const emit = vi.fn().mockResolvedValue(undefined);
    await serviceFor(prisma, { emit } as unknown as Partial<EventBus>).confirm(
      "communication-1",
      "recipient-1",
      "Ciente",
    );

    const data = update.mock.calls[0][0].data;
    expect(data.deliveryStatus).toBe(CommunicationDeliveryStatus.CONFIRMED);
    expect(data.deliveredAt).toBeInstanceOf(Date);
    expect(data.viewedAt).toBeInstanceOf(Date);
    expect(data.confirmedAt).toBeInstanceOf(Date);
    expect(data.confirmationNote).toBe("Ciente");
    expect(emit).toHaveBeenCalledWith(
      "communication.acknowledged",
      expect.objectContaining({ recipientName: "Carlos Nunes" }),
    );
  });
});

describe("sync", () => {
  it("cria novos destinatários e preserva quem já interagiu", async () => {
    const findUnique = vi.fn().mockResolvedValue(null);
    const tx = {
      communicationRecipient: {
        findUnique,
        create: vi.fn().mockResolvedValue({}),
        update: vi.fn().mockResolvedValue({}),
        deleteMany: vi.fn().mockResolvedValue({ count: 2 }),
      },
      communication: { update: vi.fn().mockResolvedValue({}) },
    };
    const prisma = {
      communication: { findUnique: vi.fn().mockResolvedValue({ id: "communication-1" }) },
      communicationAudience: {
        findMany: vi.fn().mockResolvedValue([
          { ...audienceRow, type: CommunicationAudienceType.ALL, fieldTeamId: null },
        ]),
      },
      user: {
        findMany: vi.fn().mockResolvedValue([
          { id: "user-1", name: "Admin", email: "a@eops.local", roles: [] },
        ]),
      },
      fieldMember: { findMany: vi.fn().mockResolvedValue([]) },
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };

    const result = await serviceFor(prisma).sync("communication-1");
    expect(result).toEqual({ created: 1, removed: 2, total: 1 });
    expect(tx.communicationRecipient.deleteMany).toHaveBeenCalledWith({
      where: {
        communicationId: "communication-1",
        deliveryStatus: CommunicationDeliveryStatus.PENDING,
        dedupeKey: { notIn: ["user:user-1"] },
      },
    });
    expect(tx.communication.update).toHaveBeenCalledWith({
      where: { id: "communication-1" },
      data: { recipientCount: 1 },
    });
  });

  it("remove todos os pendentes quando nenhuma regra alcança pessoas", async () => {
    const tx = {
      communicationRecipient: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        deleteMany: vi.fn().mockResolvedValue({ count: 7 }),
      },
      communication: { update: vi.fn().mockResolvedValue({}) },
    };
    const prisma = {
      communication: { findUnique: vi.fn().mockResolvedValue({ id: "communication-1" }) },
      communicationAudience: { findMany: vi.fn().mockResolvedValue([]) },
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };

    const result = await serviceFor(prisma).sync("communication-1");
    expect(result.total).toBe(0);
    expect(tx.communicationRecipient.deleteMany).toHaveBeenCalledWith({
      where: {
        communicationId: "communication-1",
        deliveryStatus: CommunicationDeliveryStatus.PENDING,
      },
    });
  });
});
