import { describe, expect, it } from "vitest";
import type { OperationalMapFeature, OperationalMapFeatureType } from "../../shared/types/operational-map";
import { CLUSTER_THRESHOLD, clusterFeatures } from "./clusterFeatures";

function feature(id: string, type: OperationalMapFeatureType, latitude: number, longitude: number): OperationalMapFeature {
  return {
    id,
    type,
    latitude,
    longitude,
    title: id,
    status: "NORMAL",
    entityId: id,
    updatedAt: "2026-10-05T10:00:00.000Z",
    metadata: {},
  };
}

describe("clusterFeatures", () => {
  it("expoe o limiar de renderizacao de clusters", () => {
    expect(CLUSTER_THRESHOLD).toBe(60);
  });

  it("agrupa pontos vizinhos e reporta centroide, contagem, tipos e ids", () => {
    const clusters = clusterFeatures(
      [feature("1", "POLLING_PLACE", 1.0, -48.0), feature("2", "INCIDENT", 1.01, -48.0), feature("3", "ASSET", 1.6, -48.0)],
      0.5,
    );
    expect(clusters).toHaveLength(2);
    const group = clusters.find((cluster) => cluster.count === 2);
    expect(group).toBeDefined();
    expect(group?.types).toEqual(["INCIDENT", "POLLING_PLACE"]);
    expect(group?.featureIds).toEqual(["1", "2"]);
    expect(group?.latitude).toBeCloseTo(1.005, 5);
    expect(clusters.find((cluster) => cluster.count === 1)?.featureIds).toEqual(["3"]);
  });

  it("produz o mesmo agrupamento independentemente da ordem de entrada", () => {
    const features = [feature("1", "POLLING_PLACE", 1.0, -48.0), feature("2", "INCIDENT", 1.01, -48.01), feature("3", "ASSET", 1.6, -48.0)];
    const forward = clusterFeatures(features, 0.5);
    const backward = clusterFeatures([...features].reverse(), 0.5);
    expect(forward.map((cluster) => cluster.id)).toEqual(backward.map((cluster) => cluster.id));
    expect(forward.map((cluster) => cluster.count)).toEqual(backward.map((cluster) => cluster.count));
    expect(forward.map((cluster) => cluster.latitude)).toEqual(backward.map((cluster) => cluster.latitude));
  });
});
