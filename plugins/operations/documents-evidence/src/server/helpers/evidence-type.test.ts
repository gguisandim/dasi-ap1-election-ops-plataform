import { EvidenceType } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  EVIDENCE_TYPE_RULES,
  guessTypeFromMime,
  isImageMime,
  isImageType,
  validateFileForType,
} from "./evidence-type";

const MEGABYTE = 1024 * 1024;

describe("validação de arquivo por tipo", () => {
  it("aceita imagem para PHOTO", () => {
    expect(validateFileForType(EvidenceType.PHOTO, "image/png", 2048)).toBeNull();
  });

  it("recusa documento não-imagem declarado como PHOTO", () => {
    expect(validateFileForType(EvidenceType.PHOTO, "application/pdf", 2048)).toContain(
      "apenas arquivos de imagem",
    );
  });

  it("recusa não-imagem declarada como SCREENSHOT", () => {
    expect(
      validateFileForType(EvidenceType.SCREENSHOT, "text/plain", 10),
    ).toContain("apenas arquivos de imagem");
  });

  it("aceita PDF para REPORT e DOCUMENT", () => {
    expect(validateFileForType(EvidenceType.REPORT, "application/pdf", 4096)).toBeNull();
    expect(validateFileForType(EvidenceType.DOCUMENT, "application/pdf", 4096)).toBeNull();
  });

  it("recusa arquivo vazio", () => {
    expect(validateFileForType(EvidenceType.DOCUMENT, "application/pdf", 0)).toContain(
      "vazio",
    );
  });

  it("aplica o limite específico do tipo PHOTO", () => {
    const overLimit = EVIDENCE_TYPE_RULES.PHOTO.maxSizeBytes + 1;
    expect(validateFileForType(EvidenceType.PHOTO, "image/jpeg", overLimit)).toContain(
      "excede o limite",
    );
    expect(validateFileForType(EvidenceType.PHOTO, "image/jpeg", overLimit - 1)).toBeNull();
  });

  it("permite arquivo maior em tipos não-imagem", () => {
    expect(
      validateFileForType(EvidenceType.LOG, "text/plain", 20 * MEGABYTE),
    ).toBeNull();
  });
});

describe("reconhecimento de MIME", () => {
  it("identifica imagens", () => {
    expect(isImageMime("image/png")).toBe(true);
    expect(isImageMime("IMAGE/JPEG")).toBe(true);
    expect(isImageMime("application/pdf")).toBe(false);
  });

  it("sugere o tipo a partir do MIME", () => {
    expect(guessTypeFromMime("image/webp")).toBe(EvidenceType.PHOTO);
    expect(guessTypeFromMime("application/pdf")).toBe(EvidenceType.REPORT);
    expect(guessTypeFromMime("text/csv")).toBe(EvidenceType.LOG);
    expect(guessTypeFromMime("application/zip")).toBe(EvidenceType.DOCUMENT);
  });

  it("marca apenas PHOTO e SCREENSHOT como tipos de imagem", () => {
    expect(isImageType(EvidenceType.PHOTO)).toBe(true);
    expect(isImageType(EvidenceType.SCREENSHOT)).toBe(true);
    expect(isImageType(EvidenceType.RECEIPT)).toBe(false);
    expect(isImageType(EvidenceType.DOCUMENT)).toBe(false);
  });
});
