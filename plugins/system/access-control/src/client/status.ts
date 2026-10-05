import type { UserStatus } from "@eops/shared/auth";

export const USER_STATUSES: UserStatus[] = ["ACTIVE", "INACTIVE", "LOCKED"];

export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  ACTIVE: "Ativo",
  INACTIVE: "Inativo",
  LOCKED: "Bloqueado",
};

export const USER_STATUS_TONES: Record<UserStatus, "neutral" | "success" | "warning" | "danger"> = {
  ACTIVE: "success",
  INACTIVE: "neutral",
  LOCKED: "danger",
};
