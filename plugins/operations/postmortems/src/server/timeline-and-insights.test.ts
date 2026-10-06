import { describe, expect, it } from "vitest";
import {
  handoverCandidates,
  incidentEventCandidates,
  incidentMilestones,
  planTimelineImport,
  resourceRequestCandidates,
  taskCandidates,
  type TimelineCandidate,
} from "./timeline-import";
import {
  actionCounters,
  averageTimeToPublishHours,
  causesByCategory,
  causesByType,
  lessonsByCategory,
  lessonsByType,
  recurringCauses,
} from "./insights";

const at = (value: string) => new Date(value);

describe("import de timeline", () => {
  it("gera marcos do incidente a partir dos carimbos já persistidos", () => {
    const candidates = incidentMilestones({
      id: "inc-1",
      code: "INC-0001",
      title: "Falha de energia",
      openedAt: at("2026-10-06T08:00:00.000Z"),
      acknowledgedAt: at("2026-10-06T08:10:00.000Z"),
      escalatedAt: at("2026-10-06T08:30:00.000Z"),
      escalationLevel: 2,
      resolvedAt: at("2026-10-06T10:00:00.000Z"),
      closedAt: null,
    });
    expect(candidates).toHaveLength(4);
    expect(candidates.map((item) => item.sourceId)).toEqual([
      "incident:inc-1:opened",
      "incident:inc-1:acknowledged",
      "incident:inc-1:escalated",
      "incident:inc-1:resolved",
    ]);
  });

  it("não gera marco para carimbo ausente", () => {
    const candidates = incidentMilestones({
      id: "inc-2",
      code: "INC-0002",
      title: "Sem marcos",
      openedAt: at("2026-10-06T08:00:00.000Z"),
      acknowledgedAt: null,
      escalatedAt: null,
      escalationLevel: 0,
      resolvedAt: null,
      closedAt: null,
    });
    expect(candidates).toHaveLength(1);
  });

  it("mapeia eventos do incidente com chave estável por evento", () => {
    const candidates = incidentEventCandidates([
      {
        id: "evt-1",
        type: "STATUS_CHANGED",
        message: "Incidente em atendimento.",
        createdAt: at("2026-10-06T09:00:00.000Z"),
      },
    ]);
    expect(candidates[0]).toMatchObject({
      sourceType: "INCIDENT_EVENT",
      sourceId: "incident-event:evt-1",
      title: "STATUS_CHANGED",
    });
  });

  it("mapeia passagens de turno por estado alcançado", () => {
    const candidates = handoverCandidates([
      {
        id: "ho-1",
        status: "CONFIRMED",
        submittedAt: at("2026-10-06T18:00:00.000Z"),
        confirmedAt: at("2026-10-06T18:20:00.000Z"),
        cancelledAt: null,
        createdAt: at("2026-10-06T17:50:00.000Z"),
        shiftName: "Turno noite",
      },
    ]);
    expect(candidates.map((item) => item.sourceId)).toEqual([
      "shift-handover:ho-1:submitted",
      "shift-handover:ho-1:confirmed",
    ]);
  });

  it("mapeia solicitações de recurso pelos marcos atingidos", () => {
    const candidates = resourceRequestCandidates([
      {
        id: "rr-1",
        code: "RR-2026-0001",
        title: "Gerador extra",
        status: "FULFILLED",
        priority: "HIGH",
        createdAt: at("2026-10-06T07:00:00.000Z"),
        submittedAt: at("2026-10-06T07:10:00.000Z"),
        approvedAt: at("2026-10-06T07:40:00.000Z"),
        fulfilledAt: at("2026-10-06T09:00:00.000Z"),
        rejectedAt: null,
      },
    ]);
    expect(candidates.map((item) => item.sourceId)).toEqual([
      "resource-request:rr-1:submitted",
      "resource-request:rr-1:approved",
      "resource-request:rr-1:fulfilled",
    ]);
  });

  it("usa criação como marco quando a solicitação não avançou", () => {
    const candidates = resourceRequestCandidates([
      {
        id: "rr-2",
        code: "RR-2026-0002",
        title: "Rascunho",
        status: "DRAFT",
        priority: "LOW",
        createdAt: at("2026-10-06T07:00:00.000Z"),
        submittedAt: null,
        approvedAt: null,
        fulfilledAt: null,
        rejectedAt: null,
      },
    ]);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].sourceId).toBe("resource-request:rr-2:created");
  });

  it("mapeia tarefas criadas e concluídas", () => {
    const candidates = taskCandidates([
      {
        id: "task-1",
        title: "Revisar enlace",
        status: "DONE",
        priority: "HIGH",
        createdAt: at("2026-10-06T08:00:00.000Z"),
        completedAt: at("2026-10-06T11:00:00.000Z"),
      },
    ]);
    expect(candidates).toHaveLength(2);
  });
});

describe("idempotência do import", () => {
  const candidates: TimelineCandidate[] = [
    {
      sourceType: "INCIDENT_EVENT",
      sourceId: "incident:inc-1:opened",
      occurredAt: at("2026-10-06T08:00:00.000Z"),
      title: "aberto",
      description: null,
    },
    {
      sourceType: "TASK",
      sourceId: "task:task-1:created",
      occurredAt: at("2026-10-06T09:00:00.000Z"),
      title: "tarefa",
      description: null,
    },
  ];

  it("cria todas as entradas na primeira importação", () => {
    const plan = planTimelineImport(candidates, new Set());
    expect(plan.toCreate).toHaveLength(2);
    expect(plan.skipped).toBe(0);
  });

  it("não recria entradas já existentes ao reimportar", () => {
    const existing = new Set(["INCIDENT_EVENT:incident:inc-1:opened"]);
    const plan = planTimelineImport(candidates, existing);
    expect(plan.toCreate.map((item) => item.sourceId)).toEqual([
      "task:task-1:created",
    ]);
    expect(plan.skipped).toBe(1);
  });

  it("não cria nada quando tudo já foi importado", () => {
    const existing = new Set([
      "INCIDENT_EVENT:incident:inc-1:opened",
      "TASK:task:task-1:created",
    ]);
    const plan = planTimelineImport(candidates, existing);
    expect(plan.toCreate).toHaveLength(0);
    expect(plan.skipped).toBe(2);
  });

  it("remove duplicatas dentro do próprio lote e ordena por horário", () => {
    const duplicates: TimelineCandidate[] = [
      ...candidates,
      { ...candidates[1] },
      {
        sourceType: "MANUAL",
        sourceId: "manual:1",
        occurredAt: at("2026-10-06T07:00:00.000Z"),
        title: "manual",
        description: null,
      },
    ];
    const plan = planTimelineImport(duplicates, new Set());
    expect(plan.toCreate).toHaveLength(3);
    expect(plan.toCreate[0].sourceId).toBe("manual:1");
    expect(plan.skipped).toBe(1);
  });
});

describe("insights", () => {
  const causes = [
    { postmortemId: "p1", type: "ROOT_CAUSE" as const, category: "PROCESS" as const, statement: "a" },
    { postmortemId: "p1", type: "CONTRIBUTING_FACTOR" as const, category: "PEOPLE" as const, statement: "b" },
    { postmortemId: "p2", type: "ROOT_CAUSE" as const, category: "PROCESS" as const, statement: "c" },
    { postmortemId: "p3", type: "ROOT_CAUSE" as const, category: "PROCESS" as const, statement: "d" },
  ];

  it("conta causas por categoria e por tipo", () => {
    expect(causesByCategory(causes)[0]).toEqual({ key: "PROCESS", count: 3 });
    expect(causesByType(causes)[0]).toEqual({ key: "ROOT_CAUSE", count: 3 });
  });

  it("reporta causas recorrentes em dois ou mais postmortems", () => {
    const recurring = recurringCauses(causes);
    expect(recurring).toEqual([
      { category: "PROCESS", type: "ROOT_CAUSE", postmortemCount: 3 },
    ]);
  });

  it("não reporta causa isolada como recorrente", () => {
    const recurring = recurringCauses([
      { postmortemId: "p1", type: "CONDITION", category: "EXTERNAL", statement: "x" },
    ]);
    expect(recurring).toEqual([]);
  });

  it("conta lições por tipo e categoria", () => {
    const lessons = [
      { type: "WENT_WELL" as const, category: null },
      { type: "WENT_WELL" as const, category: "PROCESS" as const },
      { type: "LESSON" as const, category: "PROCESS" as const },
    ];
    expect(lessonsByType(lessons)[0]).toEqual({ key: "WENT_WELL", count: 2 });
    expect(lessonsByCategory(lessons)[0]).toEqual({ key: "PROCESS", count: 2 });
  });

  it("conta ações abertas e vencidas", () => {
    const now = new Date("2026-10-06T12:00:00.000Z");
    expect(
      actionCounters(
        [
          { status: "OPEN", dueAt: at("2026-10-06T09:00:00.000Z") },
          { status: "IN_PROGRESS", dueAt: at("2026-10-07T09:00:00.000Z") },
          { status: "DONE", dueAt: at("2026-10-05T09:00:00.000Z") },
          { status: "CANCELLED", dueAt: null },
        ],
        now,
      ),
    ).toEqual({ open: 2, done: 1, cancelled: 1, overdue: 1 });
  });

  it("calcula tempo médio até publicação e devolve null sem publicações", () => {
    expect(
      averageTimeToPublishHours([
        {
          id: "p1",
          status: "PUBLISHED",
          createdAt: at("2026-10-06T00:00:00.000Z"),
          publishedAt: at("2026-10-06T06:00:00.000Z"),
          severity: "HIGH",
        },
        {
          id: "p2",
          status: "PUBLISHED",
          createdAt: at("2026-10-06T00:00:00.000Z"),
          publishedAt: at("2026-10-06T12:00:00.000Z"),
          severity: "LOW",
        },
      ]),
    ).toBe(9);
    expect(
      averageTimeToPublishHours([
        {
          id: "p1",
          status: "DRAFT",
          createdAt: at("2026-10-06T00:00:00.000Z"),
          publishedAt: null,
          severity: "LOW",
        },
      ]),
    ).toBeNull();
  });
});
