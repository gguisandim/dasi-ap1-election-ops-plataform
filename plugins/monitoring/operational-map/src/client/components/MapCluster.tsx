import { CircleMarker, Tooltip } from "react-leaflet";
import type { OperationalMapCluster } from "../utils/clusterFeatures";
import { TYPE_GLYPHS } from "../utils/labels";
import styles from "../styles/map.module.css";

export function MapCluster({ cluster }: { cluster: OperationalMapCluster }) {
  const radius = Math.min(30, 8 + cluster.count);
  return (
    <CircleMarker
      center={[cluster.latitude, cluster.longitude]}
      radius={radius}
      pathOptions={{ color: "#07111f", weight: 2, fillColor: "#38bdf8", fillOpacity: 0.85 }}
    >
      <Tooltip direction="center" permanent className={styles.clusterTooltip}>
        <span aria-hidden="true">{cluster.types.map((type) => TYPE_GLYPHS[type]).join("")}</span> {cluster.count}
      </Tooltip>
    </CircleMarker>
  );
}
