import { describe, expect, it } from "vitest";
import {
  deriveDispatchMetrics,
  dispatchRequiredFieldError,
  dispatchTransitionError,
  evaluateCapabilityMatch,
} from "./dispatch-rules";

describe("dispatch lifecycle", () => {
  it("aceita apenas transições previstas na matriz compartilhada", () => {
    expect(dispatchTransitionError("DISPATCHED", "ACCEPTED")).toBeNull();
    expect(dispatchTransitionError("ACCEPTED", "EN_ROUTE")).toBeNull();
    expect(dispatchTransitionError("EN_ROUTE", "ARRIVED")).toBeNull();
    expect(dispatchTransitionError("REQUESTED", "COMPLETED")).toMatch(
      /Transição inválida/,
    );
    expect(dispatchTransitionError("COMPLETED", "CANCELLED")).toMatch(
      /Transição inválida/,
    );
  });

  it("exige motivo na rejeição e resumo na conclusão", () => {
    expect(dispatchRequiredFieldError({ status: "REJECTED" })).toMatch(
      /motivo da rejeição/,
    );
    expect(
      dispatchRequiredFieldError({ status: "REJECTED", reason: "Equipe em outra ocorrência." }),
    ).toBeNull();
    expect(dispatchRequiredFieldError({ status: "CANCELLED", reason: "" })).toMatch(
      /motivo do cancelamento/,
    );
    expect(dispatchRequiredFieldError({ status: "COMPLETED" })).toMatch(
      /resumo da conclusão/,
    );
    expect(
      dispatchRequiredFieldError({ status: "COMPLETED", summary: "Local liberado." }),
    ).toBeNull();
  });
});

describe("capability matching", () => {
  const members = [
    { specialtyIds: ["s-1", "s-2"] },
    { specialtyIds: ["s-1"] },
  ];

  it("classifica match, partial e no match conforme os requisitos", () => {
    expect(evaluateCapabilityMatch([], null, members)).toBeNull();
    expect(
      evaluateCapabilityMatch([{ specialtyId: "s-1", requiredCount: 2 }], null, members),
    ).toBe("MATCH");
    expect(
      evaluateCapabilityMatch(
        [
          { specialtyId: "s-1", requiredCount: 2 },
          { specialtyId: "s-3", requiredCount: 1 },
        ],
        null,
        members,
      ),
    ).toBe("PARTIAL");
    expect(
      evaluateCapabilityMatch([{ specialtyId: "s-3", requiredCount: 1 }], null, members),
    ).toBe("NO_MATCH");
  });

  it("considera o tamanho mínimo da equipe", () => {
    expect(evaluateCapabilityMatch([], 3, members)).toBe("NO_MATCH");
    expect(evaluateCapabilityMatch([], 1, members)).toBe("MATCH");
  });
});

describe("derived dispatch metrics", () => {
  it("deriva os tempos a partir dos timestamps de transição", () => {
    const base = new Date("2026-10-04T10:00:00Z");
    const at = (minutes: number) => new Date(base.getTime() + minutes * 60_000);
    const metrics = deriveDispatchMetrics({
      requestedAt: base,
      dispatchedAt: at(5),
      acceptedAt: at(11),
      departedAt: at(20),
      arrivedAt: at(50),
      startedAt: at(55),
      completedAt: at(95),
    });
    expect(metrics.timeToAcceptMinutes).toBe(6);
    expect(metrics.travelMinutes).toBe(30);
    expect(metrics.timeToArrivalMinutes).toBe(39);
    expect(metrics.executionMinutes).toBe(40);
    expect(metrics.totalMinutes).toBe(95);
  });

  it("retorna nulo quando os timestamps de origem não existem", () => {
    const metrics = deriveDispatchMetrics({
      requestedAt: new Date("2026-10-04T10:00:00Z"),
      dispatchedAt: null,
      acceptedAt: null,
      departedAt: null,
      arrivedAt: null,
      startedAt: null,
      completedAt: null,
    });
    expect(metrics).toEqual({
      timeToAcceptMinutes: null,
      travelMinutes: null,
      timeToArrivalMinutes: null,
      executionMinutes: null,
      totalMinutes: null,
    });
  });
});
