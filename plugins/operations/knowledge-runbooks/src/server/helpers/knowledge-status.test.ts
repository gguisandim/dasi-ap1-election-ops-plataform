import { KnowledgeArticleStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  canTransition,
  isPublished,
  isStale,
  requiresChangeNote,
  transitionError,
} from "./knowledge-status";

describe("transições do verbete", () => {
  it("permite publicar a partir de rascunho ou revisão", () => {
    expect(canTransition(KnowledgeArticleStatus.DRAFT, KnowledgeArticleStatus.PUBLISHED)).toBe(true);
    expect(canTransition(KnowledgeArticleStatus.REVIEW, KnowledgeArticleStatus.PUBLISHED)).toBe(true);
  });

  it("permite devolver de revisão para rascunho", () => {
    expect(canTransition(KnowledgeArticleStatus.REVIEW, KnowledgeArticleStatus.DRAFT)).toBe(true);
  });

  it("só permite arquivar a partir de publicado", () => {
    expect(canTransition(KnowledgeArticleStatus.PUBLISHED, KnowledgeArticleStatus.ARCHIVED)).toBe(true);
    expect(canTransition(KnowledgeArticleStatus.PUBLISHED, KnowledgeArticleStatus.DRAFT)).toBe(false);
  });

  it("trata arquivado como terminal", () => {
    for (const status of Object.values(KnowledgeArticleStatus)) {
      expect(canTransition(KnowledgeArticleStatus.ARCHIVED, status)).toBe(false);
    }
  });

  it("recusa transição para o mesmo estado e explica o motivo", () => {
    expect(canTransition(KnowledgeArticleStatus.DRAFT, KnowledgeArticleStatus.DRAFT)).toBe(false);
    expect(transitionError(KnowledgeArticleStatus.ARCHIVED, KnowledgeArticleStatus.PUBLISHED)).toContain(
      "ARCHIVED",
    );
  });
});

describe("regras derivadas", () => {
  it("considera publicado apenas o estado PUBLISHED", () => {
    expect(isPublished(KnowledgeArticleStatus.PUBLISHED)).toBe(true);
    expect(isPublished(KnowledgeArticleStatus.REVIEW)).toBe(false);
  });

  it("exige nota de alteração fora do rascunho", () => {
    expect(requiresChangeNote(KnowledgeArticleStatus.DRAFT)).toBe(false);
    expect(requiresChangeNote(KnowledgeArticleStatus.REVIEW)).toBe(true);
    expect(requiresChangeNote(KnowledgeArticleStatus.PUBLISHED)).toBe(true);
  });

  it("marca como desatualizado após o limite de dias", () => {
    const now = new Date("2026-10-01T00:00:00.000Z");
    const recent = new Date("2026-09-01T00:00:00.000Z");
    const old = new Date("2026-01-01T00:00:00.000Z");
    expect(isStale(recent, 180, now)).toBe(false);
    expect(isStale(old, 180, now)).toBe(true);
  });
});
