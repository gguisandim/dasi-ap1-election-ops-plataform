import { CommunicationAudienceType } from "@prisma/client";

export interface AudienceShape {
  type: CommunicationAudienceType;
  electoralZoneId?: string | null;
  pollingPlaceId?: string | null;
  fieldTeamId?: string | null;
  fieldRoleId?: string | null;
  userId?: string | null;
}

/** Campo de alvo exigido por cada tipo de direcionamento. */
export const AUDIENCE_TARGET_FIELD: Record<
  Exclude<CommunicationAudienceType, "ALL">,
  keyof AudienceShape
> = {
  ELECTORAL_ZONE: "electoralZoneId",
  POLLING_PLACE: "pollingPlaceId",
  FIELD_TEAM: "fieldTeamId",
  OPERATIONAL_ROLE: "fieldRoleId",
  USER: "userId",
};

const TARGET_FIELDS: Array<keyof AudienceShape> = [
  "electoralZoneId",
  "pollingPlaceId",
  "fieldTeamId",
  "fieldRoleId",
  "userId",
];

/**
 * Valida a forma de uma regra de direcionamento.
 *
 * Retorna a mensagem de erro, ou `null` quando a regra é coerente. A regra é
 * considerada coerente quando preenche exatamente o alvo do seu tipo.
 */
export function validateAudienceShape(audience: AudienceShape): string | null {
  const expected =
    audience.type === CommunicationAudienceType.ALL
      ? null
      : AUDIENCE_TARGET_FIELD[audience.type];

  for (const field of TARGET_FIELDS) {
    const filled = Boolean(audience[field]);
    if (field === expected) {
      if (!filled) {
        return `Direcionamento ${audience.type} exige o campo ${field}.`;
      }
      continue;
    }
    if (filled) {
      return `Direcionamento ${audience.type} não aceita o campo ${field}.`;
    }
  }
  return null;
}

/** Chave estável usada para comparar e deduplicar regras de direcionamento. */
export function audienceSignature(audience: AudienceShape): string {
  const expected =
    audience.type === CommunicationAudienceType.ALL
      ? null
      : AUDIENCE_TARGET_FIELD[audience.type];
  const target = expected ? String(audience[expected]) : "*";
  return `${audience.type}:${target}`;
}

/** Remove regras repetidas preservando a ordem de entrada. */
export function dedupeAudiences<T extends AudienceShape>(audiences: T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const audience of audiences) {
    const signature = audienceSignature(audience);
    if (seen.has(signature)) continue;
    seen.add(signature);
    result.push(audience);
  }
  return result;
}

/**
 * Chave de deduplicação de destinatários.
 *
 * Pessoas são únicas por identidade, não por regra: um membro de campo
 * alcançado por uma zona e por uma equipe conta uma vez só.
 */
export function recipientDedupeKey(candidate: {
  userId?: string | null;
  memberId?: string | null;
  name: string;
}): string {
  if (candidate.userId) return `user:${candidate.userId}`;
  if (candidate.memberId) return `member:${candidate.memberId}`;
  return `name:${candidate.name.trim().toLowerCase()}`;
}

/** Texto curto para exibição da regra de direcionamento. */
export function describeAudience(
  audience: AudienceShape,
  labels: {
    electoralZone?: string | null;
    pollingPlace?: string | null;
    fieldTeam?: string | null;
    fieldRole?: string | null;
    user?: string | null;
  } = {},
): string {
  switch (audience.type) {
    case CommunicationAudienceType.ALL:
      return "Todos os usuários e equipes ativas";
    case CommunicationAudienceType.ELECTORAL_ZONE:
      return `Zona ${labels.electoralZone ?? audience.electoralZoneId ?? "—"}`;
    case CommunicationAudienceType.POLLING_PLACE:
      return `Local ${labels.pollingPlace ?? audience.pollingPlaceId ?? "—"}`;
    case CommunicationAudienceType.FIELD_TEAM:
      return `Equipe ${labels.fieldTeam ?? audience.fieldTeamId ?? "—"}`;
    case CommunicationAudienceType.OPERATIONAL_ROLE:
      return `Função ${labels.fieldRole ?? audience.fieldRoleId ?? "—"}`;
    case CommunicationAudienceType.USER:
      return `Usuário ${labels.user ?? audience.userId ?? "—"}`;
    default:
      return "Direcionamento";
  }
}
