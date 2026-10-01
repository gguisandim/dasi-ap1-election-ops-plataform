import "leaflet/dist/leaflet.css";
import { CircleMarker, MapContainer, Popup, Polyline, TileLayer } from "react-leaflet";
import { EmptyState, ErrorState, Field, Loading, Select, useAsync } from "@eops/ui";
import { useSearchParams } from "react-router-dom";
import { routesService } from "../../services/routesService";
import styles from "../../styles/overview.module.css";

export function RouteMapPage() {
  const [params, setParams] = useSearchParams();
  const routeId = params.get("routeId") ?? "";
  const routes = useAsync(routesService.list, []);
  const route = useAsync(() => routeId ? routesService.get(routeId) : Promise.resolve(undefined), [routeId]);
  const points = route.data ? [
    route.data.originLatitude != null && route.data.originLongitude != null ? { label: `Origem: ${route.data.originName}`, position: [Number(route.data.originLatitude), Number(route.data.originLongitude)] as [number, number], color: "#38bdf8" } : null,
    ...route.data.stops.filter((stop) => stop.latitude != null && stop.longitude != null).map((stop) => ({ label: `${stop.order}. ${stop.pollingPlace?.name ?? stop.description}`, position: [Number(stop.latitude), Number(stop.longitude)] as [number, number], color: stop.status === "COMPLETED" ? "#22c55e" : stop.status === "SKIPPED" ? "#ef4444" : "#f59e0b" })),
    route.data.destinationLatitude != null && route.data.destinationLongitude != null ? { label: `Destino: ${route.data.destinationName}`, position: [Number(route.data.destinationLatitude), Number(route.data.destinationLongitude)] as [number, number], color: "#a78bfa" } : null,
  ].filter((point): point is { label: string; position: [number, number]; color: string } => Boolean(point)) : [];
  return <section className={styles.page}><header className={styles.header}><div><span className={styles.tag}>MAPA</span><h1>Mapa de distribuição</h1><p>Origem, destino e paradas conectados em sequência operacional.</p></div></header><Field label="Rota"><Select value={routeId} onChange={(event) => setParams(event.target.value ? { routeId: event.target.value } : {})}><option value="">Selecione</option>{routes.data?.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</Select></Field>{(routes.loading || route.loading) && <Loading label="Carregando mapa…" />}{route.error && <ErrorState error={route.error} onRetry={route.reload} />}{route.data && points.length === 0 && <EmptyState title="Rota sem coordenadas" description="Informe coordenadas na origem, destino ou paradas para visualizar a linha." />}{route.data && points.length > 0 && <div className={styles.map}><MapContainer key={route.data.id} center={points[0].position} zoom={12} scrollWheelZoom><TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" /><Polyline positions={points.map((point) => point.position)} pathOptions={{ color: "#60a5fa", weight: 4 }} />{points.map((point) => <CircleMarker key={point.label} center={point.position} radius={9} pathOptions={{ color: point.color, fillColor: point.color, fillOpacity: 0.85 }}><Popup>{point.label}</Popup></CircleMarker>)}</MapContainer></div>}{!routeId && !routes.loading && <EmptyState title="Selecione uma rota" description="Escolha uma rota para exibir sua sequência no mapa." />}</section>;
}
