import { describe, expect, it } from "vitest";
import { normalizeKeywords, normalizeTagLabels, slugifyTag } from "./tag-slug";

describe("slug de etiqueta", () => {
  it("remove acento e normaliza separadores", () => {
    expect(slugifyTag("Conectividade Crítica")).toBe("conectividade-critica");
    expect(slugifyTag("  Energia / Elétrica ")).toBe("energia-eletrica");
  });
});

describe("normalização de etiquetas", () => {
  it("remove vazias e repetidas ignorando acento e caixa", () => {
    expect(normalizeTagLabels(["Rede", "", "rede", "  "])).toEqual(["Rede"]);
  });
});

describe("normalização de palavras-chave", () => {
  it("aplica minúsculas, sem acento, e remove curtas", () => {
    expect(normalizeKeywords(["Enlace", "de", "CONEXÃO", "ok"])).toEqual(["enlace", "conexao"]);
  });

  it("elimina repetidas e limita a 20 termos", () => {
    const many = Array.from({ length: 30 }, (_, index) => `termo${index}`);
    expect(normalizeKeywords(many)).toHaveLength(20);
    expect(normalizeKeywords(["enlace", "enlace", "ENLACE"])).toEqual(["enlace"]);
  });

  it("descarta termos longos demais", () => {
    expect(normalizeKeywords(["a".repeat(41)])).toEqual([]);
  });
});
