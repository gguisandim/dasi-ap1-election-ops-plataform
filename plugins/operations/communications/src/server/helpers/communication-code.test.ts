import { describe, expect, it } from "vitest";
import {
  formatCommunicationCode,
  nextCommunicationSequence,
  parseCommunicationSequence,
} from "./communication-code";

describe("código de comunicado", () => {
  it("formata a sequência com zeros à esquerda", () => {
    expect(formatCommunicationCode(1)).toBe("COM-00001");
    expect(formatCommunicationCode(42)).toBe("COM-00042");
    expect(formatCommunicationCode(123456)).toBe("COM-123456");
  });

  it("recusa sequências inválidas", () => {
    expect(() => formatCommunicationCode(0)).toThrow(RangeError);
    expect(() => formatCommunicationCode(-3)).toThrow(RangeError);
    expect(() => formatCommunicationCode(1.5)).toThrow(RangeError);
  });

  it("lê a sequência de um código no padrão", () => {
    expect(parseCommunicationSequence("COM-00007")).toBe(7);
  });

  it("ignora códigos fora do padrão", () => {
    expect(parseCommunicationSequence(null)).toBeNull();
    expect(parseCommunicationSequence(undefined)).toBeNull();
    expect(parseCommunicationSequence("INC-00001")).toBeNull();
    expect(parseCommunicationSequence("COM-ABC")).toBeNull();
    expect(parseCommunicationSequence("COM-00000")).toBeNull();
  });

  it("continua a numeração a partir do último código, sem reaproveitar excluídos", () => {
    expect(nextCommunicationSequence("COM-00009")).toBe(10);
    expect(nextCommunicationSequence(null)).toBe(1);
    expect(nextCommunicationSequence("lixo")).toBe(1);
  });
});
