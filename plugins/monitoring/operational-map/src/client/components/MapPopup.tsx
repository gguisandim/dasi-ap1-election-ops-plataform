import type { PollingPlaceSummary } from "@eops/shared/elections";
import { STATUS_LABELS } from "@eops/shared/elections";
import { Link } from "react-router-dom";
import styles from "../styles/map.module.css";
export function MapPopup({ place }: { place: PollingPlaceSummary }) {
  return (
    <div className={styles.popup}>
      <strong>{place.name}</strong>
      <span>Zona: {place.electoralZone.number}</span>
      <span>Seções: {place.sectionCount}</span>
      <span>Eleitores: {place.registeredVoters.toLocaleString("pt-BR")}</span>
      <b>Status: {STATUS_LABELS[place.monitoringStatus]}</b>
      <Link to={`/polling-places/${place.id}`}>Ver local</Link>
    </div>
  );
}
