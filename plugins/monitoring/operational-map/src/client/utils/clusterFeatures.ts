import type { OperationalMapFeature, OperationalMapFeatureType } from "../../shared/types/operational-map";

/** Acima deste total o cliente agrupa por grade em vez de renderizar cada marcador. */
export const CLUSTER_THRESHOLD = 60;

export interface OperationalMapCluster {
  id: string;
  latitude: number;
  longitude: number;
  count: number;
  types: OperationalMapFeatureType[];
  featureIds: string[];
}

/**
 * Agrupamento por grade geográfica determinístico. O centroide é a média das
 * coordenadas do grupo e o resultado é ordenado por identificador de célula.
 */
export function clusterFeatures(features: OperationalMapFeature[], cellSize: number): OperationalMapCluster[] {
  if (!(cellSize > 0)) throw new Error("cellSize deve ser maior que zero.");
  const cells = new Map<string, OperationalMapFeature[]>();
  for (const feature of features) {
    const id = `${Math.floor(feature.latitude / cellSize)}:${Math.floor(feature.longitude / cellSize)}`;
    const bucket = cells.get(id);
    if (bucket) bucket.push(feature);
    else cells.set(id, [feature]);
  }
  return [...cells.entries()]
    .map(([id, bucket]) => ({
      id,
      latitude: bucket.reduce((sum, feature) => sum + feature.latitude, 0) / bucket.length,
      longitude: bucket.reduce((sum, feature) => sum + feature.longitude, 0) / bucket.length,
      count: bucket.length,
      types: [...new Set(bucket.map((feature) => feature.type))].sort(),
      featureIds: bucket.map((feature) => feature.id),
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
}
