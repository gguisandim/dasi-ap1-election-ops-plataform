import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import { Button } from "@eops/ui";
import type { OperationalMapFeature } from "../../shared/types/operational-map";
import { CLUSTER_THRESHOLD, clusterFeatures } from "../utils/clusterFeatures";
import { MapCluster } from "./MapCluster";
import { MapMarker } from "./MapMarker";
import styles from "../styles/map.module.css";

const DEFAULT_CENTER: [number, number] = [-1.4558, -48.4902];
const CLUSTER_CELL_SIZE = 0.05;

function MapViewSync({ center, fullscreen, revision }: { center: [number, number]; fullscreen: boolean; revision: string }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [map, center[0], center[1], revision]);
  useEffect(() => {
    const timer = window.setTimeout(() => map.invalidateSize(), 150);
    return () => window.clearTimeout(timer);
  }, [map, fullscreen]);
  return null;
}

export function OperationalMap({ features, selectedId, onSelect }: { features: OperationalMapFeature[]; selectedId?: string; onSelect: (feature: OperationalMapFeature) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const handler = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void containerRef.current?.requestFullscreen?.();
  };

  const center: [number, number] = features[0] ? [features[0].latitude, features[0].longitude] : DEFAULT_CENTER;
  const clusters = features.length > CLUSTER_THRESHOLD ? clusterFeatures(features, CLUSTER_CELL_SIZE) : null;
  const revision = features.map((feature) => feature.id).join(",");

  return (
    <div ref={containerRef} className={`${styles.mapContainer} ${fullscreen ? styles.fullscreen : ""}`}>
      <Button className={styles.fullscreenButton} secondary onClick={toggleFullscreen}>
        {fullscreen ? "Sair da tela cheia" : "Tela cheia"}
      </Button>
      <MapContainer className={styles.map} center={center} zoom={11} scrollWheelZoom>
        <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <MapViewSync center={center} fullscreen={fullscreen} revision={revision} />
        {clusters
          ? clusters.map((cluster) => <MapCluster key={cluster.id} cluster={cluster} />)
          : features.map((feature) => (
              <MapMarker key={feature.id} feature={feature} selected={feature.id === selectedId} onSelect={onSelect} />
            ))}
      </MapContainer>
    </div>
  );
}
