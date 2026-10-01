import { CommunicationPriority, CommunicationStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  canTransition,
  compareByPriorityThenDate,
  isEditableStatus,
  isOverdueExpiration,
  isReadableStatus,
  isUrgentPriority,
  transitionError,
} from "./communication-status";

describe("máquina de estados do comunicado", () => {
  it("permite publicar a partir de rascunho e de agendado", () => {
    expect(canTransition(CommunicationStatus.DRAFT, CommunicationStatus.PUBLISHED)).toBe(true);
    expect(canTransition(CommunicationStatus.SCHEDULED, CommunicationStatus.PUBLISHED)).toBe(true);
  });

  it("permite arquivar um comunicado publicado ou expirado", () => {
    expect(canTransition(CommunicationStatus.PUBLISHED, CommunicationStatus.ARCHIVED)).toBe(true);
    expect(canTransition(CommunicationStatus.EXPIRED, CommunicationStatus.ARCHIVED)).toBe(true);
  });

  it("trata arquivado e cancelado como terminais", () => {
    const targets = Object.values(CommunicationStatus);
    for (const target of targets) {
      expect(canTransition(CommunicationStatus.ARCHIVED, target)).toBe(false);
      expect(canTransition(CommunicationStatus.CANCELLED, target)).toBe(false);
    }
  });

  it("recusa transição para o mesmo status e explica o motivo", () => {
    expect(canTransition(CommunicationStatus.DRAFT, CommunicationStatus.DRAFT)).toBe(false);
    expect(transitionError(CommunicationStatus.DRAFT, CommunicationStatus.EXPIRED)).toContain(
      "DRAFT",
    );
  });

  it("permite voltar de agendado para rascunho", () => {
    expect(canTransition(CommunicationStatus.SCHEDULED, CommunicationStatus.DRAFT)).toBe(true);
  });

  it("marca como urgente apenas prioridades alta e crítica", () => {
    expect(isUrgentPriority(CommunicationPriority.HIGH)).toBe(true);
    expect(isUrgentPriority(CommunicationPriority.CRITICAL)).toBe(true);
    expect(isUrgentPriority(CommunicationPriority.NORMAL)).toBe(false);
    expect(isUrgentPriority(CommunicationPriority.LOW)).toBe(false);
  });

  it("aceita leitura em publicado e expirado, mas não em rascunho", () => {
    expect(isReadableStatus(CommunicationStatus.PUBLISHED)).toBe(true);
    expect(isReadableStatus(CommunicationStatus.EXPIRED)).toBe(true);
    expect(isReadableStatus(CommunicationStatus.DRAFT)).toBe(false);
    expect(isReadableStatus(CommunicationStatus.CANCELLED)).toBe(false);
  });

  it("bloqueia edição de conteúdo em estados terminais", () => {
    expect(isEditableStatus(CommunicationStatus.DRAFT)).toBe(true);
    expect(isEditableStatus(CommunicationStatus.PUBLISHED)).toBe(true);
    expect(isEditableStatus(CommunicationStatus.ARCHIVED)).toBe(false);
    expect(isEditableStatus(CommunicationStatus.CANCELLED)).toBe(false);
    expect(isEditableStatus(CommunicationStatus.EXPIRED)).toBe(false);
  });
});

describe("expiração derivada", () => {
  const now = new Date("2026-10-01T12:00:00.000Z");

  it("expira quando publicado e o prazo já passou", () => {
    expect(
      isOverdueExpiration(
        { status: CommunicationStatus.PUBLISHED, expiresAt: new Date("2026-10-01T11:00:00.000Z") },
        now,
      ),
    ).toBe(true);
  });

  it("não expira dentro do prazo", () => {
    expect(
      isOverdueExpiration(
        { status: CommunicationStatus.PUBLISHED, expiresAt: new Date("2026-10-01T18:00:00.000Z") },
        now,
      ),
    ).toBe(false);
  });

  it("não expira rascunho nem comunicado sem prazo", () => {
    expect(
      isOverdueExpiration(
        { status: CommunicationStatus.DRAFT, expiresAt: new Date("2026-09-01T00:00:00.000Z") },
        now,
      ),
    ).toBe(false);
    expect(
      isOverdueExpiration({ status: CommunicationStatus.PUBLISHED, expiresAt: null }, now),
    ).toBe(false);
  });
});

describe("ordenação", () => {
  it("coloca prioridades maiores primeiro", () => {
    const ordered = [
      { priority: CommunicationPriority.LOW, createdAt: "2026-10-01T10:00:00.000Z" },
      { priority: CommunicationPriority.CRITICAL, createdAt: "2026-09-01T10:00:00.000Z" },
      { priority: CommunicationPriority.HIGH, createdAt: "2026-10-01T10:00:00.000Z" },
    ].sort(compareByPriorityThenDate);
    expect(ordered.map((item) => item.priority)).toEqual(["CRITICAL", "HIGH", "LOW"]);
  });

  it("desempata pela data mais recente", () => {
    const ordered = [
      { priority: CommunicationPriority.HIGH, createdAt: "2026-09-01T10:00:00.000Z" },
      { priority: CommunicationPriority.HIGH, createdAt: "2026-10-01T10:00:00.000Z" },
    ].sort(compareByPriorityThenDate);
    expect(ordered[0].createdAt).toBe("2026-10-01T10:00:00.000Z");
  });
});
