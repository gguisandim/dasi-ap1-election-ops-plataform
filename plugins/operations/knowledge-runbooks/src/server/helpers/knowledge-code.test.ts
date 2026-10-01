import { describe, expect, it } from "vitest";
import {
  formatKnowledgeCode,
  nextKnowledgeSequence,
  parseKnowledgeSequence,
} from "./knowledge-code";

describe("código de conhecimento", () => {
  it("formata com zeros à esquerda", () => {
    expect(formatKnowledgeCode(1)).toBe("KB-00001");
    expect(formatKnowledgeCode(1234)).toBe("KB-01234");
  });

  it("recusa sequências inválidas", () => {
    expect(() => formatKnowledgeCode(0)).toThrow(RangeError);
    expect(() => formatKnowledgeCode(-1)).toThrow(RangeError);
  });

  it("lê a sequência e ignora códigos fora do padrão", () => {
    expect(parseKnowledgeSequence("KB-00042")).toBe(42);
    expect(parseKnowledgeSequence("EVD-00001")).toBeNull();
    expect(parseKnowledgeSequence("KB-abc")).toBeNull();
    expect(parseKnowledgeSequence(null)).toBeNull();
  });

  it("continua a numeração a partir do último código", () => {
    expect(nextKnowledgeSequence("KB-00009")).toBe(10);
    expect(nextKnowledgeSequence(null)).toBe(1);
  });
});
