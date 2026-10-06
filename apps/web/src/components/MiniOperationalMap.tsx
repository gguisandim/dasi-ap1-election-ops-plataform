import { useEffect } from "react";
import { latLngBounds, type PathOptions } from "leaflet";
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from "react-leaflet";
import type { MonitoringStatus, PollingPlaceSummary } from "@eops/shared/elections";
import { STATUS_LABELS } from "@eops/shared/elections";
import "leaflet/dist/leaflet.css";

interface Props {
  places: PollingPlaceSummary[];
}

const markerStyles: Record<MonitoringStatus, PathOptions> = {
  NORMAL: { color: "#0b1b2b", fillColor: "#34d399", fillOpacity: 0.95, weight: 2 },
  ATTENTION: { color: "#0b1b2b", fillColor: "#fbbf24", fillOpacity: 0.95, weight: 2 },
  CRITICAL: { color: "#0b1b2b", fillColor: "#fb4d5b", fillOpacity: 1, weight: 2 },
  OFFLINE: { color: "#0b1b2b", fillColor: "#94a3b8", fillOpacity: 0.9, weight: 2 },
};

function FitOperationalBounds({ places }: Props) {
  const map = useMap();

  useEffect(() => {
    const bounds = latLngBounds(
      places.map((place) => [place.latitude!, place.longitude!]),
    );
    map.fitBounds(bounds, { maxZoom: 12, padding: [28, 28] });
  }, [map, places]);

  return null;
}

export function MiniOperationalMap({ places }: Props) {
  const locatedPlaces = places.filter(
    (
      place,
    ): place is PollingPlaceSummary & { latitude: number; longitude: number } =>
      typeof place.latitude === "number" &&
      typeof place.longitude === "number",
  );
  const initialPlace = locatedPlaces[0];

  if (!initialPlace) return null;

  return (
    <div
      aria-label={`Minimapa com ${locatedPlaces.length} locais georreferenciados`}
      className="mini-operational-map"
      role="region"
    >
      <MapContainer
        attributionControl
        center={[initialPlace.latitude, initialPlace.longitude]}
        className="mini-operational-map-canvas"
        doubleClickZoom={false}
        dragging
        keyboard
        scrollWheelZoom={false}
        touchZoom
        zoom={9}
        zoomControl={false}
      >
      <TileLayer
        attribution='&copy; OpenStreetMap contributors &copy; CARTO'
        url={`https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png?key=${import.meta.env.VITE_CARTO_BASEMAP_KEY}`}
        subdomains="abcd"
        maxZoom={20}
      />
        {locatedPlaces.map((place) => (
          <CircleMarker
            center={[place.latitude, place.longitude]}
            key={place.id}
            pathOptions={markerStyles[place.monitoringStatus]}
            radius={place.monitoringStatus === "CRITICAL" ? 7 : 6}
          >
            <Tooltip direction="top" offset={[0, -5]}>
              <strong>{place.name}</strong>
              <span>
                {place.city} · {STATUS_LABELS[place.monitoringStatus]}
              </span>
            </Tooltip>
          </CircleMarker>
        ))}
        <FitOperationalBounds places={locatedPlaces} />
      </MapContainer>
    </div>
  );
}
