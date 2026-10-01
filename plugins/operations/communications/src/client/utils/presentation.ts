import type {
  CommunicationAudienceType,
  CommunicationPriority,
  CommunicationStatus,
} from "@eops/shared/communications";

/** Tom visual usado pelos badges do plugin. */
export type Tone = "neutral" | "success" | "warning" | "danger" | "info";

export const PRIORITY_TONES: Record<CommunicationPriority, Tone> = {
  LOW: "neutral",
  NORMAL: "info",
  HIGH: "warning",
  CRITICAL: "danger",
};

export const STATUS_TONES: Record<CommunicationStatus, Tone> = {
  DRAFT: "neutral",
  SCHEDULED: "info",
  PUBLISHED: "success",
  EXPIRED: "warning",
  ARCHIVED: "neutral",
  CANCELLED: "danger",
};

export const AUDIENCE_ICONS: Record<CommunicationAudienceType, string> = {
  ALL: "◉",
  ELECTORAL_ZONE: "▣",
  POLLING_PLACE: "⌂",
  FIELD_TEAM: "⚑",
  OPERATIONAL_ROLE: "☰",
  USER: "☺",
};

/** Ordem de apresentação das audiências no detalhe e no formulário. */
export const AUDIENCE_ORDER: CommunicationAudienceType[] = [
  "ALL",
  "ELECTORAL_ZONE",
  "POLLING_PLACE",
  "FIELD_TEAM",
  "OPERATIONAL_ROLE",
  "USER",
];

/**
 * Prazo relativo legível: "expira em 3 h", "expirado há 2 dias".
 * Retorna `null` quando não há prazo definido.
 */
export function describeExpiration(
  expiresAt: string | null | undefined,
  now: Date = new Date(),
): string | null {
  if (!expiresAt) return null;
  const diffMs = new Date(expiresAt).getTime() - now.getTime();
  const absolute = Math.abs(diffMs);
  const minutes = Math.round(absolute / 60_000);
  const hours = Math.round(absolute / 3_600_000);
  const days = Math.round(absolute / 86_400_000);
  const amount =
    minutes < 60 ? `${minutes} min` : hours < 48 ? `${hours} h` : `${days} dias`;
  return diffMs >= 0 ? `expira em ${amount}` : `expirado há ${amount}`;
}

/** Prazo em risco: menos de 1 hora restante e ainda publicável. */
export function isExpiringSoon(
  expiresAt: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!expiresAt) return false;
  const diff = new Date(expiresAt).getTime() - now.getTime();
  return diff > 0 && diff <= 3_600_000;
}

export function audienceLabel(audience: {
  type: CommunicationAudienceType;
  label: string | null;
}): string {
  return audience.label ?? audience.type;
}

/** Rótulo curto das ações disponíveis para um status. */
export function availableActions(status: CommunicationStatus): {
  publish: boolean;
  schedule: boolean;
  cancel: boolean;
  archive: boolean;
  edit: boolean;
  remove: boolean;
} {
  return {
    publish: status === "DRAFT" || status === "SCHEDULED",
    schedule: status === "DRAFT",
    cancel: status === "DRAFT" || status === "SCHEDULED" || status === "PUBLISHED" || status === "EXPIRED",
    archive: status === "PUBLISHED" || status === "EXPIRED",
    edit: status === "DRAFT" || status === "SCHEDULED" || status === "PUBLISHED",
    remove: status === "DRAFT" || status === "SCHEDULED",
  };
}
