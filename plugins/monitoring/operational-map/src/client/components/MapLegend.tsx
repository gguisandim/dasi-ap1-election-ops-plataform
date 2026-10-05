import { Badge } from "@eops/ui";
import { OPERATIONAL_MAP_TYPES, OPERATIONAL_MAP_TYPE_LABELS } from "../../shared/types/operational-map";
import { TYPE_GLYPHS, statusLabel, statusTone } from "../utils/labels";
import styles from "../styles/map.module.css";

const STATUSES = ["NORMAL", "ATTENTION", "CRITICAL", "OFFLINE"];

export function MapLegend() {
  return (
    <div className={styles.legend} aria-label="Legenda do mapa">
      <div>
        <b>Camadas</b>
        {OPERATIONAL_MAP_TYPES.map((type) => (
          <span key={type}>
            <i data-type={type} aria-hidden="true">{TYPE_GLYPHS[type]}</i>
            {OPERATIONAL_MAP_TYPE_LABELS[type]}
          </span>
        ))}
      </div>
      <div>
        <b>Status</b>
        {STATUSES.map((status) => (
          <span key={status}>
            <Badge tone={statusTone(status)}>{statusLabel(status)}</Badge>
          </span>
        ))}
      </div>
    </div>
  );
}
