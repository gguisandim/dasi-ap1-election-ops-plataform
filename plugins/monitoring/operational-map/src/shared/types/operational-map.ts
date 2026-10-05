/**
 * Contrato neutro entre o backend agregador do mapa e o cliente.
 * Nenhum objeto Prisma é exposto: apenas features geográficas resolvidas.
 */
export const OPERATIONAL_MAP_TYPES = [
  "POLLING_PLACE",
  "INCIDENT",
  "TRANSMISSION",
  "FIELD_TEAM",
  "ROUTE",
  "ASSET",
] as const;

export type OperationalMapFeatureType = (typeof OPERATIONAL_MAP_TYPES)[number];

export interface OperationalMapFeature {
  id: string; // `${type}:${entityId}`
  type: OperationalMapFeatureType;
  latitude: number;
  longitude: number;
  title: string;
  subtitle?: string;
  status: string;
  severity?: string;
  entityId: string;
  updatedAt: string;
  metadata: Record<string, string | number | boolean | null>;
  deepLink?: string;
}

export const OPERATIONAL_MAP_TYPE_LABELS: Record<OperationalMapFeatureType, string> = {
  POLLING_PLACE: "Local de votação",
  INCIDENT: "Incidente",
  TRANSMISSION: "Transmissão",
  FIELD_TEAM: "Equipe de campo",
  ROUTE: "Rota",
  ASSET: "Ativo",
};
