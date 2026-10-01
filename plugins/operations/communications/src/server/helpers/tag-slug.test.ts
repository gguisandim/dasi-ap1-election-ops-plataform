import { describe, expect, it } from "vitest";
import { normalizeTagLabels, slugifyTag } from "./tag-slug";

describe("slug de etiqueta", () => {
  it("remove acentos e normaliza separadores", () => {
    expect(slugifyTag("Prioridade Alta")).toBe("prioridade-alta");
    expect(slugifyTag("Comunicação Crítica")).toBe("comunicacao-critica");
    expect(slugifyTag("  Energia   Elétrica  ")).toBe("energia-eletrica");
  });

  it("remove pontuação e separadores nas pontas", () => {
    expect(slugifyTag("--Falha / de rede!--")).toBe("falha-de-rede");
  });

  it("limita o comprimento a 60 caracteres", () => {
    expect(slugifyTag("a".repeat(120))).toHaveLength(60);
  });

  it("retorna vazio quando não sobra conteúdo utilizável", () => {
    expect(slugifyTag("!!!")).toBe("");
  });
});

describe("normalização da lista de etiquetas", () => {
  it("remove vazias, aplica trim e colapsa espaços", () => {
    expect(normalizeTagLabels(["  Turno   da manhã ", "", "   "])).toEqual([
      "Turno da manhã",
    ]);
  });

  it("remove repetidas ignorando acento e caixa", () => {
    expect(normalizeTagLabels(["Energia", "energia", "ENERGIA"])).toEqual(["Energia"]);
  });

  it("descarta etiquetas acima de 60 caracteres", () => {
    expect(normalizeTagLabels(["ok", "x".repeat(61)])).toEqual(["ok"]);
  });

  it("preserva a ordem de entrada", () => {
    expect(normalizeTagLabels(["beta", "alfa", "gama"])).toEqual(["beta", "alfa", "gama"]);
  });
});
