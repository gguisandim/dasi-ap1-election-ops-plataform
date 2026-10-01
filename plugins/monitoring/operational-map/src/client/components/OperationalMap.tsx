import { MapContainer, TileLayer } from "react-leaflet";
import type { PollingPlaceSummary } from "@eops/shared/elections";
import { MapMarker } from "./MapMarker";
import styles from "../styles/map.module.css";
export function OperationalMap({ places }: { places: PollingPlaceSummary[] }) {
  const first = places[0];
  const center: [number, number] =
    first?.latitude !== null &&
    first?.longitude !== null &&
    first?.latitude !== undefined &&
    first?.longitude !== undefined
      ? [first.latitude, first.longitude]
      : [-1.4558, -48.4902];
  return (
    <MapContainer
      className={styles.map}
      center={center}
      zoom={11}
      scrollWheelZoom
    >
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {places.map((place) => (
        <MapMarker key={place.id} place={place} />
      ))}
    </MapContainer>
  );
}
