import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "@eops/database";
import type { EventBus } from "@eops/event-bus";
import { TasksService } from "./tasks.service";

const storedTask = {
  id: "task-1",
  status: "PENDING",
  priority: "MEDIUM",
  assigneeId: null,
  dependencies: [],
};

function serviceWith(prisma: unknown, emit = vi.fn().mockResolvedValue(undefined)) {
  return new TasksService(
    prisma as PrismaService,
    { emit } as unknown as EventBus,
  );
}

describe("task field execution", () => {
  it("persiste execução em campo e requisitos de especialidade", async () => {
    const tx = {
      task: {
        create: vi.fn().mockResolvedValue({ id: "task-1" }),
        findUniqueOrThrow: vi.fn().mockResolvedValue(storedTask),
      },
      taskHistory: { create: vi.fn() },
    };
    const prisma = {
      election: { findUnique: vi.fn().mockResolvedValue({ id: "election-1" }) },
      fieldSpecialty: { count: vi.fn().mockResolvedValue(1) },
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    await serviceWith(prisma).createTask(
      {
        title: "Vistoria no local",
        electionId: "election-1",
        executionMode: "FIELD",
        requiredTeamSize: 2,
        requiredSpecialtyIds: ["specialty-1"],
      },
      "user-1",
    );
    expect(tx.task.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          executionMode: "FIELD",
          requiredTeamSize: 2,
          specialtyRequirements: {
            create: [{ specialtyId: "specialty-1", requiredCount: 1 }],
          },
        }),
      }),
    );
  });

  it("mantém OFFICE como padrão e não cria requisitos sem especialidades", async () => {
    const tx = {
      task: {
        create: vi.fn().mockResolvedValue({ id: "task-1" }),
        findUniqueOrThrow: vi.fn().mockResolvedValue(storedTask),
      },
      taskHistory: { create: vi.fn() },
    };
    const prisma = {
      election: { findUnique: vi.fn().mockResolvedValue({ id: "election-1" }) },
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    await serviceWith(prisma).createTask(
      { title: "Consolidar relatório", electionId: "election-1" },
      "user-1",
    );
    expect(tx.task.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          executionMode: "OFFICE",
          specialtyRequirements: undefined,
        }),
      }),
    );
  });

  it("recusa requisito com especialidade inválida", async () => {
    const prisma = {
      election: { findUnique: vi.fn().mockResolvedValue({ id: "election-1" }) },
      fieldSpecialty: { count: vi.fn().mockResolvedValue(0) },
    };
    await expect(
      serviceWith(prisma).createTask(
        {
          title: "Vistoria no local",
          electionId: "election-1",
          executionMode: "FIELD",
          requiredSpecialtyIds: ["specialty-x"],
        },
        "user-1",
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
