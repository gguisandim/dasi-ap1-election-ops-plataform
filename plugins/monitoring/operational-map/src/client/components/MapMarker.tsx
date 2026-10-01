import { CircleMarker, Popup } from "react-leaflet";
import type { PollingPlaceSummary } from "@eops/shared";
import { MapPopup } from "./MapPopup";
const colors = {
  NORMAL: "#39c998",
  ATTENTION: "#f0bb4e",
  CRITICAL: "#ef5e6b",
  OFFLINE: "#788595",
} as const;
export function MapMarker({ place }: { place: PollingPlaceSummary }) {
  if (place.latitude === null || place.longitude === null) return null;
  return (
    <CircleMarker
      className="operational-marker"
      center={[place.latitude, place.longitude]}
      radius={9}
      pathOptions={{
        color: "#07111f",
        weight: 2,
        fillColor: colors[place.monitoringStatus],
        fillOpacity: 0.95,
      }}
    >
      <Popup>
        <MapPopup place={place} />
      </Popup>
    </CircleMarker>
  );
}
