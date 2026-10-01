import {
  EVIDENCE_LINK_LABELS,
  EVIDENCE_TYPE_LABELS,
  type EvidenceLinkType,
  type EvidenceType,
} from "@eops/shared/evidence";

export type Tone = "neutral" | "success" | "warning" | "danger" | "info";

/** Glifos por tipo de evidência, usados em badges e miniaturas. */
export const TYPE_ICONS: Record<EvidenceType, string> = {
  PHOTO: "▣",
  DOCUMENT: "▤",
  RECEIPT: "▥",
  REPORT: "▦",
  LOG: "▧",
  SCREENSHOT: "▨",
  OTHER: "▩",
};

export const LINK_ICONS: Record<EvidenceLinkType, string> = {
  INCIDENT: "!",
  ASSET: "⚙",
  POLLING_PLACE: "⌂",
  ELECTORAL_ZONE: "▣",
  ROUTE: "⇢",
  DELIVERY: "▤",
  TRANSMISSION: "≋",
  RISK: "△",
  COMMUNICATION: "✉",
  FIELD_TEAM: "⚑",
  OTHER: "•",
};

/** Tom de apoio por tipo, usado nos badges. */
export const TYPE_TONES: Record<EvidenceType, Tone> = {
  PHOTO: "info",
  DOCUMENT: "neutral",
  RECEIPT: "success",
  REPORT: "info",
  LOG: "warning",
  SCREENSHOT: "info",
  OTHER: "neutral",
};

export function typeLabel(type: EvidenceType): string {
  return EVIDENCE_TYPE_LABELS[type];
}

export function linkTypeLabel(type: EvidenceLinkType): string {
  return EVIDENCE_LINK_LABELS[type];
}

/** Sugere um tipo a partir da extensão do arquivo escolhido pelo usuário. */
export function guessTypeFromFileName(fileName: string): EvidenceType {
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (["png", "jpg", "jpeg", "webp", "gif", "heic", "bmp"].includes(extension)) return "PHOTO";
  if (["pdf", "doc", "docx", "odt"].includes(extension)) return "REPORT";
  if (["csv", "txt", "log", "json"].includes(extension)) return "LOG";
  return "OTHER";
}
