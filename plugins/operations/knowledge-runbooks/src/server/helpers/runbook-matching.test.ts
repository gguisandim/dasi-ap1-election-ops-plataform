import { describe, expect, it } from "vitest";
import {
  compareRecommendations,
  normalizeText,
  scoreRunbook,
  successRate,
  tokenize,
} from "./runbook-matching";

const candidate = {
  incidentCategoryKey: "CONNECTIVITY",
  incidentSeverity: "HIGH",
  assetTypeKey: "ROUTER",
  keywords: ["enlace", "timeout", "reconexao"],
};

describe("score de recomendação", () => {
  it("pontua no máximo 100 quando todos os critérios coincidem", () => {
    const { score, breakdown } = scoreRunbook(
      {
        categoryKey: "CONNECTIVITY",
        severity: "HIGH",
        assetTypeKey: "ROUTER",
        text: "enlace caiu com timeout e sem reconexao",
      },
      candidate,
    );
    // 40 categoria + 20 severidade + 15 tipo de ativo + 3 palavras-chave (15).
    expect(score).toBe(90);
    expect(breakdown.incidentCategory).toBe(40);
    expect(breakdown.severity).toBe(20);
    expect(breakdown.assetType).toBe(15);
    expect(breakdown.keywords).toBe(15);
  });

  it("soma apenas categoria quando é o único critério em comum", () => {
    const { score, breakdown } = scoreRunbook({ categoryKey: "CONNECTIVITY" }, candidate);
    expect(score).toBe(40);
    expect(breakdown.severity).toBe(0);
    expect(breakdown.keywords).toBe(0);
  });

  it("ignora categoria diferente", () => {
    const { score } = scoreRunbook({ categoryKey: "POWER" }, candidate);
    expect(score).toBe(0);
  });

  it("ignora severidade diferente e nula", () => {
    expect(scoreRunbook({ severity: "LOW" }, candidate).score).toBe(0);
    expect(scoreRunbook({ severity: null }, candidate).score).toBe(0);
  });

  it("limita a contribuição das palavras-chave a 25", () => {
    const { breakdown } = scoreRunbook(
      { text: "enlace timeout reconexao queda perda falha" },
      { keywords: ["enlace", "timeout", "reconexao", "queda", "perda", "falha", "extra"] },
    );
    expect(breakdown.keywords).toBe(25);
    expect(breakdown.matchedKeywords).toHaveLength(6);
  });

  it("não pontua palavra-chave quando não há texto", () => {
    const { breakdown } = scoreRunbook({}, candidate);
    expect(breakdown.keywords).toBe(0);
    expect(breakdown.matchedKeywords).toEqual([]);
  });

  it("casa palavra-chave ignorando acento e caixa", () => {
    const { breakdown } = scoreRunbook(
      { text: "Perda de CONEXÃO no enlace" },
      { keywords: ["conexao"] },
    );
    expect(breakdown.matchedKeywords).toEqual(["conexao"]);
    expect(breakdown.keywords).toBe(5);
  });

  it("descreve os motivos que compuseram o score", () => {
    const { reasons } = scoreRunbook(
      { categoryKey: "CONNECTIVITY", severity: "HIGH", text: "enlace caiu" },
      candidate,
    );
    expect(reasons).toHaveLength(3);
    expect(reasons.join(" ")).toContain("CONNECTIVITY");
    expect(reasons.join(" ")).toContain("enlace");
  });
});

describe("normalização de texto", () => {
  it("remove acento, pontuação e caixa", () => {
    expect(normalizeText("Conexão PERDIDA! (enlace)")).toBe("conexao perdida enlace");
  });

  it("descarta palavras vazias e termos curtos", () => {
    const tokens = tokenize("a rede de dados caiu no local");
    expect(tokens).toContain("rede");
    expect(tokens).toContain("dados");
    expect(tokens).not.toContain("de");
    expect(tokens).not.toContain("no");
  });

  it("elimina repetições", () => {
    expect(tokenize("timeout timeout timeout")).toEqual(["timeout"]);
  });

  it("devolve vazio para texto ausente", () => {
    expect(tokenize(null)).toEqual([]);
    expect(tokenize(undefined)).toEqual([]);
  });
});

describe("ordenação determinística", () => {
  const base = { resolvedCount: 0, successRate: 0, usageCount: 0, title: "B" };

  it("coloca maior score primeiro", () => {
    const ordered = [
      { ...base, score: 40, title: "A" },
      { ...base, score: 80, title: "C" },
    ].sort(compareRecommendations);
    expect(ordered[0].score).toBe(80);
  });

  it("desempata por quem já resolveu mais", () => {
    const ordered = [
      { ...base, score: 60, resolvedCount: 1, title: "A" },
      { ...base, score: 60, resolvedCount: 5, title: "C" },
    ].sort(compareRecommendations);
    expect(ordered[0].resolvedCount).toBe(5);
  });

  it("desempata por taxa de sucesso e depois por uso", () => {
    const ordered = [
      { ...base, score: 60, successRate: 50, usageCount: 2, title: "A" },
      { ...base, score: 60, successRate: 80, usageCount: 1, title: "C" },
    ].sort(compareRecommendations);
    expect(ordered[0].successRate).toBe(80);
  });

  it("usa o título como critério final, evitando ordem instável", () => {
    const ordered = [
      { ...base, score: 60, title: "Zebra" },
      { ...base, score: 60, title: "Abelha" },
    ].sort(compareRecommendations);
    expect(ordered.map((item) => item.title)).toEqual(["Abelha", "Zebra"]);
  });
});

describe("taxa de sucesso", () => {
  it("calcula com uma casa decimal", () => {
    expect(successRate(1, 3)).toBe(33.3);
    expect(successRate(4, 4)).toBe(100);
  });

  it("devolve zero sem execuções", () => {
    expect(successRate(0, 0)).toBe(0);
  });
});
