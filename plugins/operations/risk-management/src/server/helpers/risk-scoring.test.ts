import { RiskImpact, RiskLevel, RiskProbability } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  assessRisk,
  averageProgress,
  buildRiskMatrix,
  classifyRisk,
  computeRiskScore,
  isEscalation,
  isMitigationOverdue,
  isRiskOverdue,
  RISK_SCALE_ORDER,
} from "./risk-scoring";

describe("cálculo do score", () => {
  it("multiplica os valores da escala", () => {
    expect(computeRiskScore(RiskProbability.VERY_LOW, RiskImpact.VERY_LOW)).toBe(1);
    expect(computeRiskScore(RiskProbability.MEDIUM, RiskImpact.MEDIUM)).toBe(9);
    expect(computeRiskScore(RiskProbability.VERY_HIGH, RiskImpact.VERY_HIGH)).toBe(25);
    expect(computeRiskScore(RiskProbability.HIGH, RiskImpact.MEDIUM)).toBe(12);
  });

  it("mantém o produto dentro de 1 a 25 para toda a escala", () => {
    const scores = RISK_SCALE_ORDER.flatMap((probability) =>
      RISK_SCALE_ORDER.map((impact) => computeRiskScore(probability, impact)),
    );
    expect(Math.min(...scores)).toBe(1);
    expect(Math.max(...scores)).toBe(25);
  });
});

describe("classificação por faixa", () => {
  it("classifica os limites de cada faixa", () => {
    expect(classifyRisk(1)).toBe(RiskLevel.LOW);
    expect(classifyRisk(4)).toBe(RiskLevel.LOW);
    expect(classifyRisk(5)).toBe(RiskLevel.MODERATE);
    expect(classifyRisk(9)).toBe(RiskLevel.MODERATE);
    expect(classifyRisk(10)).toBe(RiskLevel.HIGH);
    expect(classifyRisk(15)).toBe(RiskLevel.HIGH);
    expect(classifyRisk(16)).toBe(RiskLevel.CRITICAL);
    expect(classifyRisk(25)).toBe(RiskLevel.CRITICAL);
  });

  it("classifica todas as combinações da escala", () => {
    expect(assessRisk(RiskProbability.VERY_HIGH, RiskImpact.VERY_HIGH)).toEqual({
      score: 25,
      level: RiskLevel.CRITICAL,
    });
    expect(assessRisk(RiskProbability.LOW, RiskImpact.LOW)).toEqual({
      score: 4,
      level: RiskLevel.LOW,
    });
  });
});

describe("matriz 5x5", () => {
  it("tem cinco linhas de cinco colunas", () => {
    const matrix = buildRiskMatrix();
    expect(matrix).toHaveLength(5);
    for (const row of matrix) expect(row).toHaveLength(5);
  });

  it("usa exatamente as mesmas regras da classificação do registro", () => {
    for (const row of buildRiskMatrix()) {
      for (const cell of row) {
        expect(cell.score).toBe(computeRiskScore(cell.probability, cell.impact));
        expect(cell.level).toBe(classifyRisk(cell.score));
      }
    }
  });

  it("apresenta a maior probabilidade na primeira linha e o menor impacto na primeira coluna", () => {
    const matrix = buildRiskMatrix();
    expect(matrix[0][0].probability).toBe(RiskProbability.VERY_HIGH);
    expect(matrix[0][0].impact).toBe(RiskImpact.VERY_LOW);
    expect(matrix[4][4].probability).toBe(RiskProbability.VERY_LOW);
    expect(matrix[4][4].impact).toBe(RiskImpact.VERY_HIGH);
    expect(matrix[4][4].score).toBe(5);
    expect(matrix[4][4].level).toBe(RiskLevel.MODERATE);
  });
});

describe("escalonamento", () => {
  it("detecta subida de faixa", () => {
    expect(isEscalation(RiskLevel.LOW, RiskLevel.HIGH)).toBe(true);
    expect(isEscalation(RiskLevel.MODERATE, RiskLevel.CRITICAL)).toBe(true);
  });

  it("não considera escalonamento quando a faixa se mantém ou melhora", () => {
    expect(isEscalation(RiskLevel.HIGH, RiskLevel.HIGH)).toBe(false);
    expect(isEscalation(RiskLevel.CRITICAL, RiskLevel.HIGH)).toBe(false);
  });
});

describe("progresso das mitigações", () => {
  it("calcula a média das mitigações não canceladas", () => {
    expect(
      averageProgress([
        { status: "COMPLETED", progress: 100 },
        { status: "IN_PROGRESS", progress: 50 },
        { status: "PLANNED", progress: 0 },
      ]),
    ).toBe(50);
  });

  it("ignora mitigações canceladas", () => {
    expect(
      averageProgress([
        { status: "COMPLETED", progress: 100 },
        { status: "CANCELLED", progress: 0 },
      ]),
    ).toBe(100);
  });

  it("devolve nulo quando não há plano", () => {
    expect(averageProgress([])).toBeNull();
    expect(averageProgress([{ status: "CANCELLED", progress: 30 }])).toBeNull();
  });
});

describe("atraso", () => {
  const now = new Date("2026-10-01T12:00:00.000Z");

  it("marca ação com prazo vencido e não concluída", () => {
    expect(
      isMitigationOverdue(
        { dueDate: "2026-09-01T00:00:00.000Z", status: "IN_PROGRESS" },
        now,
      ),
    ).toBe(true);
  });

  it("não marca ação concluída, cancelada, futura ou sem prazo", () => {
    expect(
      isMitigationOverdue({ dueDate: "2026-09-01T00:00:00.000Z", status: "COMPLETED" }, now),
    ).toBe(false);
    expect(
      isMitigationOverdue({ dueDate: "2026-09-01T00:00:00.000Z", status: "CANCELLED" }, now),
    ).toBe(false);
    expect(
      isMitigationOverdue({ dueDate: "2026-12-01T00:00:00.000Z", status: "PLANNED" }, now),
    ).toBe(false);
    expect(isMitigationOverdue({ dueDate: null, status: "PLANNED" }, now)).toBe(false);
  });

  it("marca o prazo do risco vencido, exceto se encerrado ou materializado", () => {
    expect(isRiskOverdue({ dueDate: "2026-09-01T00:00:00.000Z", status: "MITIGATING" }, now)).toBe(
      true,
    );
    expect(isRiskOverdue({ dueDate: "2026-09-01T00:00:00.000Z", status: "CLOSED" }, now)).toBe(
      false,
    );
    expect(
      isRiskOverdue({ dueDate: "2026-09-01T00:00:00.000Z", status: "MATERIALIZED" }, now),
    ).toBe(false);
  });
});
