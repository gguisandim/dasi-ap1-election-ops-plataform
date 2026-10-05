import L from "leaflet";
import { Marker, Popup } from "react-leaflet";
import type { OperationalMapFeature } from "../../shared/types/operational-map";
import { TYPE_GLYPHS, statusLabel } from "../utils/labels";
import { MapPopup } from "./MapPopup";
import styles from "../styles/map.module.css";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);
}

export function MapMarker({ feature, selected = false, onSelect }: { feature: OperationalMapFeature; selected?: boolean; onSelect?: (feature: OperationalMapFeature) => void }) {
  const label = feature.title.length > 22 ? `${feature.title.slice(0, 21)}…` : feature.title;
  const icon = L.divIcon({
    className: styles.markerWrapper,
    html:
      `<span class="${styles.markerGlyph}" data-type="${feature.type}" data-status="${feature.status}" data-selected="${selected}" aria-hidden="true">${TYPE_GLYPHS[feature.type]}</span>` +
      `<span class="${styles.markerLabel}">${escapeHtml(label)}</span>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
    popupAnchor: [0, -12],
  });
  return (
    <Marker
      position={[feature.latitude, feature.longitude]}
      icon={icon}
      alt={`${feature.title} — ${statusLabel(feature.status)}`}
      eventHandlers={{ click: () => onSelect?.(feature) }}
    >
      <Popup>
        <MapPopup feature={feature} />
      </Popup>
    </Marker>
  );
}
