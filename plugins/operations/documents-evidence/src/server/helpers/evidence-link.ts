import { EvidenceLinkType } from "@prisma/client";

/**
 * Tipos cujo alvo é resolvido no banco central para validação e rótulo.
 * `OTHER` aceita qualquer identificador — é a saída para registros que ainda
 * não têm entidade própria na plataforma.
 */
export const RESOLVABLE_LINK_TYPES: EvidenceLinkType[] = [
  EvidenceLinkType.INCIDENT,
  EvidenceLinkType.ASSET,
  EvidenceLinkType.POLLING_PLACE,
  EvidenceLinkType.ELECTORAL_ZONE,
  EvidenceLinkType.ROUTE,
  EvidenceLinkType.DELIVERY,
  EvidenceLinkType.TRANSMISSION,
  EvidenceLinkType.COMMUNICATION,
  EvidenceLinkType.FIELD_TEAM,
];

export interface LinkTargetInput {
  type: EvidenceLinkType;
  targetId: string;
  notes?: string;
}

/** Chave estável para deduplicar vínculos antes de persistir. */
export function linkSignature(link: LinkTargetInput): string {
  return `${link.type}:${link.targetId}`;
}

export function dedupeLinks<T extends LinkTargetInput>(links: T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const link of links) {
    const signature = linkSignature(link);
    if (seen.has(signature)) continue;
    seen.add(signature);
    result.push(link);
  }
  return result;
}

/** Rótulo de exibição de um alvo resolvido no banco central. */
export function describeTarget(type: EvidenceLinkType, parts: Array<string | null | undefined>): string {
  const detail = parts.filter((part): part is string => Boolean(part)).join(" · ");
  return detail || type;
}
