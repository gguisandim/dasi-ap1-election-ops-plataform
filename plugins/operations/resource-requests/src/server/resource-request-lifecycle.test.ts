import { describe, expect, it } from "vitest";
import {
  RESOURCE_REQUEST_TRANSITIONS,
  availableResourceRequestActions,
  canTransitionResourceRequest,
  compareResourceRequestQueue,
  deriveFulfillmentStatus,
  deriveUrgency,
  fulfillmentProgressPercent,
  isTerminalResourceRequestStatus,
  resourceRequestCode,
  summarizeFulfillment,
  type ResourceRequestStatus,
} from "@eops/shared/resource-requests";

const ALL_STATUSES = Object.keys(
  RESOURCE_REQUEST_TRANSITIONS,
) as ResourceRequestStatus[];

describe("lifecycle de solicitação", () => {
  it("permite apenas as transições da tabela normativa", () => {
    const allowed: Array<[ResourceRequestStatus, ResourceRequestStatus]> = [
      ["DRAFT", "SUBMITTED"],
      ["DRAFT", "CANCELLED"],
      ["SUBMITTED", "TRIAGED"],
      ["SUBMITTED", "REJECTED"],
      ["SUBMITTED", "CANCELLED"],
      ["TRIAGED", "APPROVED"],
      ["TRIAGED", "REJECTED"],
      ["TRIAGED", "CANCELLED"],
      ["APPROVED", "PARTIALLY_FULFILLED"],
      ["APPROVED", "FULFILLED"],
      ["APPROVED", "CANCELLED"],
      ["PARTIALLY_FULFILLED", "FULFILLED"],
      ["PARTIALLY_FULFILLED", "CANCELLED"],
    ];
    for (const [from, to] of allowed)
      expect(canTransitionResourceRequest(from, to), `${from}→${to}`).toBe(true);
  });

  it("rejeita regressão e transições arbitrárias", () => {
    const denied: Array<[ResourceRequestStatus, ResourceRequestStatus]> = [
      ["SUBMITTED", "DRAFT"],
      ["TRIAGED", "SUBMITTED"],
      ["APPROVED", "TRIAGED"],
      ["PARTIALLY_FULFILLED", "APPROVED"],
      ["FULFILLED", "PARTIALLY_FULFILLED"],
      ["REJECTED", "TRIAGED"],
      ["CANCELLED", "DRAFT"],
      ["SUBMITTED", "APPROVED"],
      ["DRAFT", "APPROVED"],
      ["REJECTED", "DRAFT"],
    ];
    for (const [from, to] of denied)
      expect(canTransitionResourceRequest(from, to), `${from}→${to}`).toBe(false);
  });

  it("mantém todos os status terminais sem saída", () => {
    for (const status of ALL_STATUSES) {
      const isTerminal = isTerminalResourceRequestStatus(status);
      if (isTerminal)
        expect(RESOURCE_REQUEST_TRANSITIONS[status], status).toHaveLength(0);
    }
  });

  it("gera código legível por ano", () => {
    expect(resourceRequestCode(2026, 7)).toBe("RR-2026-0007");
    expect(resourceRequestCode(2026, 1234)).toBe("RR-2026-1234");
  });
});

describe("urgência derivada", () => {
  const now = new Date("2026-10-06T12:00:00.000Z");

  it("é COMPLETED em status terminal", () => {
    for (const status of ["FULFILLED", "REJECTED", "CANCELLED"] as const)
      expect(deriveUrgency({ status, neededAt: null, now })).toBe("COMPLETED");
  });

  it("é ON_TRACK sem prazo informado", () => {
    expect(deriveUrgency({ status: "SUBMITTED", neededAt: null, now })).toBe(
      "ON_TRACK",
    );
  });

  it("é OVERDUE depois do prazo", () => {
    expect(
      deriveUrgency({
        status: "APPROVED",
        neededAt: new Date("2026-10-06T09:00:00.000Z"),
        now,
      }),
    ).toBe("OVERDUE");
  });

  it("é DUE_SOON dentro da janela de 4 horas", () => {
    expect(
      deriveUrgency({
        status: "APPROVED",
        neededAt: new Date("2026-10-06T15:00:00.000Z"),
        now,
      }),
    ).toBe("DUE_SOON");
  });

  it("é ON_TRACK fora da janela", () => {
    expect(
      deriveUrgency({
        status: "APPROVED",
        neededAt: new Date("2026-10-07T12:00:00.000Z"),
        now,
      }),
    ).toBe("ON_TRACK");
  });
});

describe("cálculo de fulfillment", () => {
  it("soma quantidades por item", () => {
    expect(
      summarizeFulfillment([
        { quantity: 3, fulfilledQuantity: 1 },
        { quantity: 2, fulfilledQuantity: 2 },
      ]),
    ).toEqual({
      totalRequired: 5,
      totalFulfilled: 3,
      totalRemaining: 2,
      totalItems: 2,
      satisfiedItems: 1,
      fullySatisfied: false,
      anyFulfilled: true,
    });
  });

  it("deriva PARTIALLY_FULFILLED quando há atendimento parcial", () => {
    expect(
      deriveFulfillmentStatus([
        { quantity: 2, fulfilledQuantity: 2 },
        { quantity: 2, fulfilledQuantity: 1 },
      ]),
    ).toBe("PARTIALLY_FULFILLED");
  });

  it("deriva FULFILLED somente quando todos os itens são satisfeitos", () => {
    expect(
      deriveFulfillmentStatus([
        { quantity: 2, fulfilledQuantity: 2 },
        { quantity: 1, fulfilledQuantity: 3 },
      ]),
    ).toBe("FULFILLED");
  });

  it("não altera o status quando não há nenhum atendimento", () => {
    expect(
      deriveFulfillmentStatus([
        { quantity: 2, fulfilledQuantity: 0 },
        { quantity: 1, fulfilledQuantity: 0 },
      ]),
    ).toBeNull();
  });

  it("não altera o status quando não há itens", () => {
    expect(deriveFulfillmentStatus([])).toBeNull();
  });

  it("calcula progresso percentual limitado a 100", () => {
    expect(
      fulfillmentProgressPercent(
        summarizeFulfillment([{ quantity: 4, fulfilledQuantity: 1 }]),
      ),
    ).toBe(25);
    expect(
      fulfillmentProgressPercent(
        summarizeFulfillment([{ quantity: 1, fulfilledQuantity: 5 }]),
      ),
    ).toBe(100);
    expect(fulfillmentProgressPercent(summarizeFulfillment([]))).toBe(0);
  });
});

describe("availableActions", () => {
  const base = {
    requestedById: "requester",
    ownerId: null,
    actorId: "requester",
    permissions: [] as string[],
  };

  it("permite submeter apenas ao solicitante em rascunho", () => {
    expect(
      availableResourceRequestActions({ ...base, status: "DRAFT" }),
    ).toEqual(["edit", "submit", "cancel", "addComment"]);
  });

  it("exige approver para aprovar e rejeitar", () => {
    expect(
      availableResourceRequestActions({
        ...base,
        status: "SUBMITTED",
        actorId: "approver",
        permissions: ["resource-requests.approve"],
      }),
    ).toEqual(["approve", "reject", "addComment"]);
  });

  it("exige fulfill para registrar atendimento", () => {
    expect(
      availableResourceRequestActions({
        ...base,
        status: "APPROVED",
        actorId: "fulfiller",
        permissions: ["resource-requests.fulfill"],
      }),
    ).toEqual(["addFulfillment", "removeFulfillment", "addComment"]);
  });

  it("não oferece cancelamento em status terminal", () => {
    expect(
      availableResourceRequestActions({
        ...base,
        status: "FULFILLED",
        permissions: ["resource-requests.manage"],
      }),
    ).toEqual(["addComment"]);
  });

  it("permite ao owner cancelar pedido aprovado", () => {
    expect(
      availableResourceRequestActions({
        ...base,
        status: "APPROVED",
        ownerId: "owner",
        actorId: "owner",
      }),
    ).toContain("cancel");
  });
});

describe("ordenação da fila", () => {
  const now = "2026-10-06T12:00:00.000Z";
  it("ordena por urgência, prioridade, prazo e idade", () => {
    const rows = [
      {
        label: "on-track-critical",
        urgency: "ON_TRACK" as const,
        priority: "CRITICAL" as const,
        neededAt: null,
        createdAt: now,
      },
      {
        label: "overdue-low",
        urgency: "OVERDUE" as const,
        priority: "LOW" as const,
        neededAt: null,
        createdAt: now,
      },
      {
        label: "overdue-high-newer",
        urgency: "OVERDUE" as const,
        priority: "HIGH" as const,
        neededAt: "2026-10-06T08:00:00.000Z",
        createdAt: "2026-10-06T07:00:00.000Z",
      },
      {
        label: "overdue-high-older",
        urgency: "OVERDUE" as const,
        priority: "HIGH" as const,
        neededAt: "2026-10-06T06:00:00.000Z",
        createdAt: "2026-10-06T05:00:00.000Z",
      },
      {
        label: "completed",
        urgency: "COMPLETED" as const,
        priority: "CRITICAL" as const,
        neededAt: null,
        createdAt: now,
      },
    ];
    const ordered = [...rows].sort(compareResourceRequestQueue);
    expect(ordered.map((row) => row.label)).toEqual([
      "overdue-high-older",
      "overdue-high-newer",
      "overdue-low",
      "on-track-critical",
      "completed",
    ]);
  });
});
