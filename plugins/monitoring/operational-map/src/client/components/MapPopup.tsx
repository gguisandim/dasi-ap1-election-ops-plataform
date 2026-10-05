import { Badge } from "@eops/ui";
import { Link } from "react-router-dom";
import { OPERATIONAL_MAP_TYPE_LABELS, type OperationalMapFeature } from "../../shared/types/operational-map";
import { statusLabel, statusTone } from "../utils/labels";
import styles from "../styles/map.module.css";

export function MapPopup({ feature }: { feature: OperationalMapFeature }) {
  return (
    <div className={styles.popup}>
      <small>{OPERATIONAL_MAP_TYPE_LABELS[feature.type]}</small>
      <strong>{feature.title}</strong>
      {feature.subtitle && <span>{feature.subtitle}</span>}
      <span>Status: <Badge tone={statusTone(feature.status)}>{statusLabel(feature.status)}</Badge></span>
      {feature.severity && <span>Severidade: {feature.severity}</span>}
      {feature.deepLink && <Link to={feature.deepLink}>Abrir domínio</Link>}
    </div>
  );
}
