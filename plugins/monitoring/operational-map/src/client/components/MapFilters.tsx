import { Button, Select } from "@eops/ui";
import type { ElectoralZoneSummary } from "@eops/shared/elections";
import { INCIDENT_SEVERITIES, INCIDENT_SEVERITY_LABELS } from "@eops/shared/incidents";
import type { MapFiltersValue } from "../services/operationalMapService";
import { statusLabel } from "../utils/labels";
import styles from "../styles/map.module.css";

interface Props {
  value: MapFiltersValue;
  zones: ElectoralZoneSummary[];
  statuses: string[];
  onChange: (value: MapFiltersValue) => void;
  onReset: () => void;
}

export function MapFilters({ value, zones, statuses, onChange, onReset }: Props) {
  return (
    <div className={styles.filters}>
      <Select aria-label="Zona" value={value.zoneId} onChange={(event) => onChange({ ...value, zoneId: event.target.value })}>
        <option value="">Todas as zonas</option>
        {zones.map((zone) => (
          <option key={zone.id} value={zone.id}>Zona {zone.number} · {zone.municipality}</option>
        ))}
      </Select>
      <Select aria-label="Severidade" value={value.severity} onChange={(event) => onChange({ ...value, severity: event.target.value as MapFiltersValue["severity"] })}>
        <option value="">Todas as severidades</option>
        {INCIDENT_SEVERITIES.map((severity) => (
          <option key={severity} value={severity}>{INCIDENT_SEVERITY_LABELS[severity]}</option>
        ))}
      </Select>
      <Select aria-label="Status" value={value.status} onChange={(event) => onChange({ ...value, status: event.target.value })}>
        <option value="">Todos os status</option>
        {statuses.map((status) => (
          <option key={status} value={status}>{statusLabel(status)}</option>
        ))}
      </Select>
      <Button onClick={onReset}>Limpar filtros</Button>
    </div>
  );
}
