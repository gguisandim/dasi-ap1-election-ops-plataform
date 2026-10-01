import { EvidenceType } from "@prisma/client";

export interface EvidenceTypeRule {
  /** Aceita apenas arquivos de imagem. */
  imageOnly: boolean;
  /** Limite de tamanho específico do tipo, em bytes. */
  maxSizeBytes: number;
}

const MEGABYTE = 1024 * 1024;
const DEFAULT_MAX_SIZE = 25 * MEGABYTE;

/**
 * Regras por tipo de evidência.
 *
 * `PHOTO` e `SCREENSHOT` representam imagem por definição, então exigem MIME de
 * imagem. `LOG` é o único tipo que aceita texto puro.
 */
export const EVIDENCE_TYPE_RULES: Record<EvidenceType, EvidenceTypeRule> = {
  PHOTO: { imageOnly: true, maxSizeBytes: 15 * MEGABYTE },
  SCREENSHOT: { imageOnly: true, maxSizeBytes: 15 * MEGABYTE },
  DOCUMENT: { imageOnly: false, maxSizeBytes: DEFAULT_MAX_SIZE },
  RECEIPT: { imageOnly: false, maxSizeBytes: DEFAULT_MAX_SIZE },
  REPORT: { imageOnly: false, maxSizeBytes: DEFAULT_MAX_SIZE },
  LOG: { imageOnly: false, maxSizeBytes: DEFAULT_MAX_SIZE },
  OTHER: { imageOnly: false, maxSizeBytes: DEFAULT_MAX_SIZE },
};

const IMAGE_MIME_PREFIX = "image/";

export function isImageMime(mimeType: string): boolean {
  return mimeType.toLowerCase().startsWith(IMAGE_MIME_PREFIX);
}

/**
 * Valida o par (tipo declarado, MIME real).
 *
 * Retorna a mensagem de erro ou `null`. O objetivo é impedir que uma foto seja
 * arquivada como `LOG` ou que um PDF seja arquivado como `PHOTO`, o que
 * quebraria a galeria e a leitura da evidência.
 */
export function validateFileForType(
  type: EvidenceType,
  mimeType: string,
  size: number,
): string | null {
  const rule = EVIDENCE_TYPE_RULES[type];
  if (size <= 0) return "O arquivo enviado está vazio.";
  if (size > rule.maxSizeBytes) {
    return `O arquivo excede o limite de ${Math.round(rule.maxSizeBytes / MEGABYTE)} MB para o tipo ${type}.`;
  }
  if (rule.imageOnly && !isImageMime(mimeType)) {
    return `O tipo ${type} aceita apenas arquivos de imagem; recebido ${mimeType}.`;
  }
  return null;
}

/** Tipos sugeridos quando o usuário envia apenas um arquivo, sem escolher tipo. */
export function guessTypeFromMime(mimeType: string): EvidenceType {
  if (isImageMime(mimeType)) return EvidenceType.PHOTO;
  if (mimeType === "application/pdf") return EvidenceType.REPORT;
  if (mimeType.startsWith("text/")) return EvidenceType.LOG;
  return EvidenceType.DOCUMENT;
}

export function isImageType(type: EvidenceType): boolean {
  return EVIDENCE_TYPE_RULES[type].imageOnly;
}
