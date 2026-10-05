import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "@eops/database";
import type { EventBus } from "@eops/event-bus";
import { FieldDispatchService } from "./field-dispatch.service";

const activeTeam = {
  id: "team-1",
  name: "Equipe Alfa",
  code: "ALFA",
  status: "ACTIVE",
  electionId: "election-1",
};

function serviceWith(prisma: unknown, eventBus?: unknown) {
  return new FieldDispatchService(
    prisma as PrismaService,
    eventBus as EventBus | undefined,
  );
}

describe("FieldDispatchService eligibility", () => {
  it("bloqueia dispatch para membro indisponível", async () => {
    const prisma = {
      fieldTeam: { findUnique: vi.fn().mockResolvedValue(activeTeam) },
      fieldMember: {
        findUnique: vi.fn().mockResolvedValue({
          id: "member-1",
          teamId: "team-1",
          status: "UNAVAILABLE",
        }),
      },
    };
    await expect(
      serviceWith(prisma).create(
        { teamId: "team-1", memberId: "member-1", title: "Apoio ao local" },
        "user-1",
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("bloqueia dispatch quando já existe outro dispatch ativo para o destino", async () => {
    const prisma = {
      fieldTeam: { findUnique: vi.fn().mockResolvedValue(activeTeam) },
      fieldDispatch: { findFirst: vi.fn().mockResolvedValue({ id: "dispatch-0" }) },
    };
    await expect(
      serviceWith(prisma).create({ teamId: "team-1", title: "Apoio" }, "user-1"),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("recusa equipe inexistente", async () => {
    const prisma = { fieldTeam: { findUnique: vi.fn().mockResolvedValue(null) } };
    await expect(
      serviceWith(prisma).create({ teamId: "team-x", title: "Apoio" }, "user-1"),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("exige justificativa quando a capability não é atendida", async () => {
    const prisma = {
      fieldTeam: { findUnique: vi.fn().mockResolvedValue(activeTeam) },
      fieldDispatch: { findFirst: vi.fn().mockResolvedValue(null) },
      fieldSpecialty: { count: vi.fn().mockResolvedValue(1) },
      fieldMember: { findMany: vi.fn().mockResolvedValue([]) },
    };
    await expect(
      serviceWith(prisma).create(
        {
          teamId: "team-1",
          title: "Apoio especializado",
          requiredSpecialtyIds: ["specialty-1"],
        },
        "user-1",
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe("FieldDispatchService lifecycle", () => {
  it("rejeita transição fora da matriz sem tocar no banco", async () => {
    const update = vi.fn();
    const prisma = {
      fieldDispatch: {
        findUnique: vi.fn().mockResolvedValue({
          id: "dispatch-1",
          status: "REQUESTED",
          teamId: "team-1",
          memberId: null,
        }),
      },
      $transaction: vi.fn((callback: (client: unknown) => unknown) =>
        callback({ fieldDispatch: { update } }),
      ),
    };
    await expect(
      serviceWith(prisma).transition(
        "dispatch-1",
        { status: "COMPLETED", summary: "Concluído" },
        "user-1",
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(update).not.toHaveBeenCalled();
  });

  it("exige motivo para rejeitar", async () => {
    const prisma = {
      fieldDispatch: {
        findUnique: vi.fn().mockResolvedValue({
          id: "dispatch-1",
          status: "DISPATCHED",
          teamId: "team-1",
          memberId: null,
        }),
      },
    };
    await expect(
      serviceWith(prisma).transition("dispatch-1", { status: "REJECTED" }, "user-1"),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("conclui registrando timestamp, timeline e evento", async () => {
    const emit = vi.fn().mockResolvedValue(undefined);
    const current = {
      id: "dispatch-1",
      teamId: "team-1",
      memberId: null,
      taskId: "task-1",
      status: "IN_PROGRESS",
      requestedAt: new Date("2026-10-04T10:00:00Z"),
      acceptedAt: new Date("2026-10-04T10:10:00Z"),
    };
    const saved = {
      ...current,
      status: "COMPLETED",
      priority: "HIGH",
      capabilityMatch: null,
      incidentId: null,
      completedAt: new Date("2026-10-04T11:00:00Z"),
      team: { id: "team-1", name: "Equipe Alfa", code: "ALFA" },
      member: null,
      task: { id: "task-1", title: "Vistoria" },
      incident: null,
    };
    const tx = {
      fieldDispatch: { update: vi.fn().mockResolvedValue(saved) },
      fieldDispatchEvent: { create: vi.fn() },
    };
    const prisma = {
      fieldDispatch: { findUnique: vi.fn().mockResolvedValue(current) },
      fieldMember: { findMany: vi.fn().mockResolvedValue([]) },
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const result = await serviceWith(prisma, { emit }).transition(
      "dispatch-1",
      { status: "COMPLETED", summary: "Local liberado." },
      "user-1",
    );
    expect(tx.fieldDispatch.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "COMPLETED",
          completedAt: expect.any(Date),
          completionSummary: "Local liberado.",
        }),
      }),
    );
    expect(tx.fieldDispatchEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "COMPLETED",
          fromStatus: "IN_PROGRESS",
          toStatus: "COMPLETED",
        }),
      }),
    );
    expect(emit).toHaveBeenCalledWith(
      "field_dispatch.completed",
      expect.objectContaining({ entityId: "dispatch-1", summary: "Local liberado." }),
    );
    expect(result.status).toBe("COMPLETED");
  });

  it("vincula a Task e reaproveita prioridade e requisitos da demanda", async () => {
    const created = {
      id: "dispatch-3",
      teamId: "team-1",
      memberId: null,
      taskId: "task-1",
      incidentId: null,
      status: "REQUESTED",
      priority: "HIGH",
      title: "Vistoria no local",
      capabilityMatch: "MATCH",
      requestedAt: new Date("2026-10-04T10:00:00Z"),
      acceptedAt: null,
      completedAt: null,
      team: { id: "team-1", name: "Equipe Alfa", code: "ALFA" },
      member: null,
      task: { id: "task-1", title: "Vistoria no local" },
      incident: null,
    };
    const tx = {
      fieldDispatch: { create: vi.fn().mockResolvedValue(created) },
      fieldDispatchEvent: { create: vi.fn() },
    };
    const prisma = {
      fieldTeam: { findUnique: vi.fn().mockResolvedValue(activeTeam) },
      task: {
        findUnique: vi.fn().mockResolvedValue({
          id: "task-1",
          title: "Vistoria no local",
          priority: "HIGH",
          requiredTeamSize: null,
          specialtyRequirements: [{ specialtyId: "specialty-1", requiredCount: 1 }],
        }),
      },
      fieldDispatch: { findFirst: vi.fn().mockResolvedValue(null) },
      fieldMember: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            {
              id: "member-1",
              teamId: "team-1",
              specialties: [
                { specialtyId: "specialty-1", specialty: { name: "Elétrica" } },
              ],
            },
          ]),
      },
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const result = await serviceWith(prisma).create(
      { teamId: "team-1", taskId: "task-1" },
      "user-1",
    );
    expect(tx.fieldDispatch.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          taskId: "task-1",
          priority: "HIGH",
          capabilityMatch: "MATCH",
        }),
      }),
    );
    expect(result.taskId).toBe("task-1");
  });

  it("publica field_dispatch.created ao solicitar demanda genérica", async () => {
    const emit = vi.fn().mockResolvedValue(undefined);
    const created = {
      id: "dispatch-2",
      teamId: "team-1",
      memberId: null,
      taskId: null,
      incidentId: null,
      status: "REQUESTED",
      priority: "MEDIUM",
      title: "Apoio logístico",
      capabilityMatch: null,
      requestedAt: new Date("2026-10-04T10:00:00Z"),
      acceptedAt: null,
      completedAt: null,
      team: { id: "team-1", name: "Equipe Alfa", code: "ALFA" },
      member: null,
      task: null,
      incident: null,
    };
    const tx = {
      fieldDispatch: { create: vi.fn().mockResolvedValue(created) },
      fieldDispatchEvent: { create: vi.fn() },
    };
    const prisma = {
      fieldTeam: { findUnique: vi.fn().mockResolvedValue(activeTeam) },
      fieldDispatch: { findFirst: vi.fn().mockResolvedValue(null) },
      fieldMember: { findMany: vi.fn().mockResolvedValue([]) },
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const result = await serviceWith(prisma, { emit }).create(
      { teamId: "team-1", title: "Apoio logístico" },
      "user-1",
    );
    expect(tx.fieldDispatchEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: "CREATED" }),
      }),
    );
    expect(emit).toHaveBeenCalledWith(
      "field_dispatch.created",
      expect.objectContaining({ entityId: "dispatch-2", priority: "MEDIUM" }),
    );
    expect(result.status).toBe("REQUESTED");
  });
});
