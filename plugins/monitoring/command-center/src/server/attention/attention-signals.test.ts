import { describe, expect, it } from "vitest";
import {
  ATTENTION_WEIGHTS,
  ageWeightPoints,
  classifyAttentionItem,
  compareAttentionItems,
  computeAttentionScore,
  deriveOperationalHealth,
  type OperationalAttentionItem,
} from "@eops/shared/command-center";
import {
  computeAttention,
  deadlineFrom,
  incidentStatusState,
  type DispatchSignalRow,
  type HandoverSignalRow,
  type IncidentSignalRow,
  type PreparationSignalRow,
  type ResourceRequestSignalRow,
  type ShiftCoverageSignalRow,
} from "./attention-signals";

const NOW = new Date("2026-10-06T12:00:00.000Z");
const hoursAgo = (hours: number) => new Date(NOW.getTime() - hours * 3_600_000);
const hoursAhead = (hours: number) =>
  new Date(NOW.getTime() + hours * 3_600_000);

function incident(
  overrides: Partial<IncidentSignalRow> = {},
): IncidentSignalRow {
  return {
    id: "inc-1",
    code: "INC-0001",
    title: "Falha de energia",
    severity: "MEDIUM",
    status: "IN_PROGRESS",
    electionId: "election-1",
    electoralZoneId: "zone-1",
    pollingPlaceId: "place-1",
    openedAt: hoursAgo(2),
    slaDeadline: null,
    acknowledgedAt: hoursAgo(2),
    escalationLevel: 0,
    ...overrides,
  };
}

describe("attention score", () => {
  it("soma pesos de severidade, prazo, estado, idade e impacto", () => {
    expect(
      computeAttentionScore({
        severity: "CRITICAL",
        deadlineState: "OVERDUE",
        statusState: "BLOCKED",
        ageSeconds: 3 * 3600,
        impactWeight: 20,
      }),
    ).toBe(100 + 50 + 15 + 3 + 20);
  });

  it("limita o peso de idade a 40 pontos", () => {
    expect(ageWeightPoints(5 * 3600)).toBe(5);
    expect(ageWeightPoints(500 * 3600)).toBe(ATTENTION_WEIGHTS.age.maxPoints);
    expect(ageWeightPoints(-10)).toBe(0);
  });

  it("produz ordenação total e estável com scores empatados", () => {
    const base = {
      summary: "x",
      severity: "HIGH" as const,
      status: "OPEN",
      statusState: "WAITING" as const,
      deadlineState: "NONE" as const,
      ageSeconds: 0,
      score: 65,
      occurredAt: NOW.toISOString(),
      deepLink: "/x",
      metadata: {},
    };
    const items: OperationalAttentionItem[] = [
      { ...base, id: "ROUTE:b", sourceType: "ROUTE", sourceId: "b" },
      { ...base, id: "INCIDENT:z", sourceType: "INCIDENT", sourceId: "z" },
      { ...base, id: "INCIDENT:a", sourceType: "INCIDENT", sourceId: "a" },
    ];
    expect(items.sort(compareAttentionItems).map((item) => item.id)).toEqual([
      "INCIDENT:a",
      "INCIDENT:z",
      "ROUTE:b",
    ]);
  });
});

describe("health", () => {
  it("é NORMAL sem itens", () => {
    expect(deriveOperationalHealth([])).toBe("NORMAL");
  });

  it("é ATTENTION quando existem apenas avisos", () => {
    const item = {
      severity: "MEDIUM" as const,
      deadlineState: "DUE_SOON" as const,
      statusState: "WAITING" as const,
    };
    expect(classifyAttentionItem(item)).toBe("WARNING");
    expect(
      deriveOperationalHealth([item] as OperationalAttentionItem[]),
    ).toBe("ATTENTION");
  });

  it("é CRITICAL com prazo vencido ou estado bloqueado", () => {
    const overdue = {
      severity: "MEDIUM" as const,
      deadlineState: "OVERDUE" as const,
      statusState: "WAITING" as const,
    };
    const blocked = {
      severity: "MEDIUM" as const,
      deadlineState: "NONE" as const,
      statusState: "BLOCKED" as const,
    };
    expect(
      deriveOperationalHealth([overdue] as OperationalAttentionItem[]),
    ).toBe("CRITICAL");
    expect(
      deriveOperationalHealth([blocked] as OperationalAttentionItem[]),
    ).toBe("CRITICAL");
  });
});

describe("sinais de incidente", () => {
  it("classifica incidente não reconhecido", () => {
    expect(
      incidentStatusState(
        incident({ status: "NEW", acknowledgedAt: null }),
        NOW,
      ),
    ).toBe("UNACKNOWLEDGED");
  });

  it("trata escalonamento antes de reconhecimento", () => {
    expect(
      incidentStatusState(incident({ escalationLevel: 2 }), NOW),
    ).toBe("ESCALATED");
  });

  it("ignora incidente de severidade baixa sem outro gatilho", () => {
    const result = computeAttention({
      now: NOW,
      loaded: { incidents: [incident({ severity: "LOW" })] },
    });
    expect(result.items).toHaveLength(0);
    expect(result.health).toBe("NORMAL");
    expect(result.metrics.activeIncidents).toBe(1);
  });

  it("reporta incidente crítico com impacto de incidente crítico", () => {
    const result = computeAttention({
      now: NOW,
      loaded: { incidents: [incident({ severity: "CRITICAL" })] },
    });
    expect(result.criticalItems).toHaveLength(1);
    expect(result.items[0].deepLink).toBe("/incidents/inc-1");
    expect(result.items[0].score).toBe(
      100 + 0 + 0 + 2 + ATTENTION_WEIGHTS.impact.incidentCritical,
    );
  });
});

describe("sinais de cobertura e continuidade", () => {
  it("trata turno sem operadores como bloqueio crítico", () => {
    const shift: ShiftCoverageSignalRow = {
      id: "shift-1",
      name: "Turno A",
      status: "SCHEDULED",
      startsAt: hoursAhead(1),
      requiredOperators: 4,
      assignedOperators: 0,
      electoralZoneId: "zone-1",
      pollingPlaceId: null,
      electionId: "election-1",
    };
    const result = computeAttention({
      now: NOW,
      loaded: { workforce: { shifts: [shift], dispatches: [] } },
    });
    expect(result.criticalItems).toHaveLength(1);
    expect(result.items[0].statusState).toBe("BLOCKED");
    expect(result.metrics.shiftsCoverageEmpty).toBe(1);
    expect(result.metrics.shiftsCoverageCritical).toBe(0);
  });

  it("trata cobertura parcial como atenção, não bloqueio", () => {
    const shift: ShiftCoverageSignalRow = {
      id: "shift-2",
      name: "Turno B",
      status: "SCHEDULED",
      startsAt: hoursAhead(1),
      requiredOperators: 4,
      assignedOperators: 2,
      electoralZoneId: "zone-1",
      pollingPlaceId: null,
      electionId: "election-1",
    };
    const result = computeAttention({
      now: NOW,
      loaded: { workforce: { shifts: [shift], dispatches: [] } },
    });
    expect(result.items[0].statusState).toBe("WAITING");
    expect(result.metrics.shiftsCoverageCritical).toBe(1);
  });

  it("escala passagem pendente há mais de 24h e calcula a idade", () => {
    const handover: HandoverSignalRow = {
      id: "handover-1",
      status: "PENDING_CONFIRMATION",
      submittedAt: hoursAgo(30),
      confirmedAt: null,
      createdAt: hoursAgo(30),
      shiftName: "Turno C",
      electoralZoneId: "zone-1",
      pollingPlaceId: null,
      electionId: "election-1",
    };
    const result = computeAttention({
      now: NOW,
      loaded: { continuity: [handover] },
    });
    expect(result.items[0].severity).toBe("HIGH");
    expect(result.items[0].deadlineState).toBe("OVERDUE");
    expect(result.metrics.pendingHandovers).toBe(1);
    expect(result.metrics.oldestPendingHandoverAgeSeconds).toBe(30 * 3600);
  });

  it("conta apenas passagens confirmadas hoje", () => {
    const confirmed: HandoverSignalRow = {
      id: "handover-2",
      status: "CONFIRMED",
      submittedAt: hoursAgo(5),
      confirmedAt: hoursAgo(4),
      createdAt: hoursAgo(5),
      shiftName: "Turno D",
      electoralZoneId: null,
      pollingPlaceId: null,
      electionId: "election-1",
    };
    const yesterday: HandoverSignalRow = {
      ...confirmed,
      id: "handover-3",
      confirmedAt: new Date("2026-10-05T20:00:00.000Z"),
    };
    const result = computeAttention({
      now: NOW,
      loaded: { continuity: [confirmed, yesterday] },
    });
    expect(result.metrics.confirmedHandoversToday).toBe(1);
  });
});

describe("sinais de preparação, logística e recursos", () => {
  it("trata item obrigatório bloqueado como crítico", () => {
    const checklist: PreparationSignalRow = {
      id: "check-1",
      status: "IN_PROGRESS",
      dueAt: hoursAhead(6),
      pollingPlaceName: "Escola A",
      blockedRequiredItems: 2,
      electoralZoneId: "zone-1",
      pollingPlaceId: "place-1",
      electionId: "election-1",
    };
    const result = computeAttention({
      now: NOW,
      loaded: { preparation: [checklist] },
    });
    expect(result.items[0].severity).toBe("CRITICAL");
    expect(result.items[0].statusState).toBe("BLOCKED");
    expect(result.items[0].deepLink).toBe("/preparation-checklists/check-1");
    expect(result.metrics.preparationBlocked).toBe(1);
  });

  it("classifica dispatch de prioridade alta como atenção", () => {
    const dispatch: DispatchSignalRow = {
      id: "dispatch-1",
      title: "Reparo de urna",
      status: "REQUESTED",
      priority: "HIGH",
      requestedAt: hoursAgo(1),
      electoralZoneId: "zone-1",
      pollingPlaceId: null,
      electionId: "election-1",
    };
    const result = computeAttention({
      now: NOW,
      loaded: { workforce: { shifts: [], dispatches: [dispatch] } },
    });
    expect(result.items[0].sourceType).toBe("FIELD_DISPATCH");
    expect(result.items[0].statusState).toBe("WAITING");
    expect(result.metrics.waitingDispatches).toBe(1);
  });

  it("marca solicitação de recurso vencida como crítica", () => {
    const request: ResourceRequestSignalRow = {
      id: "request-1",
      code: "RR-2026-0001",
      title: "Gerador extra",
      status: "APPROVED",
      priority: "HIGH",
      neededAt: hoursAgo(2),
      createdAt: hoursAgo(30),
      approvedAt: hoursAgo(20),
      electoralZoneId: "zone-1",
      pollingPlaceId: null,
      electionId: "election-1",
    };
    const result = computeAttention({
      now: NOW,
      loaded: { resourceRequests: [request] },
    });
    expect(result.items[0].deadlineState).toBe("OVERDUE");
    expect(result.items[0].severity).toBe("CRITICAL");
    expect(result.items[0].deepLink).toBe("/resource-requests/request-1");
    expect(result.metrics.resourceRequestsOverdue).toBe(1);
    expect(result.metrics.resourceRequestsApprovedUnfulfilled).toBe(1);
  });

  it("ignora solicitação encerrada", () => {
    const result = computeAttention({
      now: NOW,
      loaded: {
        resourceRequests: [
          {
            id: "request-2",
            code: "RR-2026-0002",
            title: "Fechada",
            status: "FULFILLED",
            priority: "CRITICAL",
            neededAt: hoursAgo(10),
            createdAt: hoursAgo(40),
            approvedAt: hoursAgo(30),
            electoralZoneId: null,
            pollingPlaceId: null,
            electionId: "election-1",
          },
        ],
      },
    });
    expect(result.items).toHaveLength(0);
    expect(result.metrics.resourceRequestsCritical).toBe(0);
    expect(result.metrics.resourceRequestsOverdue).toBe(0);
  });
});

describe("filtragem por permissão", () => {
  const loaded = {
    incidents: [incident({ severity: "CRITICAL" })],
    continuity: [
      {
        id: "handover-1",
        status: "PENDING_CONFIRMATION",
        submittedAt: hoursAgo(2),
        confirmedAt: null,
        createdAt: hoursAgo(2),
        shiftName: "Turno",
        electoralZoneId: "zone-1",
        pollingPlaceId: null,
        electionId: "election-1",
      } satisfies HandoverSignalRow,
    ],
  };

  it("deixa métricas de seções não carregadas como nulas", () => {
    const result = computeAttention({ now: NOW, loaded });
    expect(result.metrics.activeIncidents).toBe(1);
    expect(result.metrics.pendingHandovers).toBe(1);
    expect(result.metrics.transmissionFailures).toBeNull();
    expect(result.metrics.routesDelayed).toBeNull();
    expect(result.metrics.resourceRequestsOverdue).toBeNull();
    expect(result.metrics.preparationBlocked).toBeNull();
    expect(result.items.map((item) => item.sourceType).sort()).toEqual([
      "INCIDENT",
      "SHIFT_HANDOVER",
    ]);
  });

  it("não produz nenhum item quando nenhuma seção é autorizada", () => {
    const result = computeAttention({ now: NOW, loaded: {} });
    expect(result.items).toHaveLength(0);
    expect(result.health).toBe("NORMAL");
    expect(result.metrics.totalItems).toBe(0);
  });
});

describe("agregação por zona", () => {
  it("acumula itens e contadores por zona eleitoral", () => {
    const result = computeAttention({
      now: NOW,
      loaded: {
        incidents: [
          incident({ id: "inc-1", severity: "CRITICAL", electoralZoneId: "zone-1" }),
          incident({ id: "inc-2", severity: "HIGH", electoralZoneId: "zone-2" }),
        ],
        preparation: [
          {
            id: "check-1",
            status: "BLOCKED",
            dueAt: null,
            pollingPlaceName: "Escola",
            blockedRequiredItems: 1,
            electoralZoneId: "zone-1",
            pollingPlaceId: "place-1",
            electionId: "election-1",
          } satisfies PreparationSignalRow,
        ],
      },
    });
    const zone1 = result.zoneCounters.get("zone-1");
    const zone2 = result.zoneCounters.get("zone-2");
    expect(zone1).toMatchObject({
      itemCount: 2,
      criticalItemCount: 2,
      activeIncidents: 1,
      preparationBlockers: 1,
    });
    expect(zone2).toMatchObject({
      itemCount: 1,
      criticalItemCount: 0,
      activeIncidents: 1,
      preparationBlockers: 0,
    });
  });
});

describe("deadlineFrom", () => {
  it("classifica vencido, próximo e no prazo", () => {
    expect(deadlineFrom(hoursAgo(1), NOW)).toBe("OVERDUE");
    expect(deadlineFrom(hoursAhead(2), NOW)).toBe("DUE_SOON");
    expect(deadlineFrom(hoursAhead(10), NOW)).toBe("ON_TRACK");
    expect(deadlineFrom(null, NOW)).toBe("NONE");
  });
});
