import { Button, Select } from "@eops/ui";
import { MONITORING_STATUSES, STATUS_LABELS, type ElectionSummary, type ElectoralZoneSummary } from "@eops/shared/elections";
import type { MapFiltersValue } from "../services/operationalMapService";
import styles from "../styles/map.module.css";
interface Props {
  value: MapFiltersValue;
  elections: ElectionSummary[];
  zones: ElectoralZoneSummary[];
  municipalities: string[];
  onChange: (value: MapFiltersValue) => void;
  onReset: () => void;
}
export function MapFilters({
  value,
  elections,
  zones,
  municipalities,
  onChange,
  onReset,
}: Props) {
  const visibleZones = value.electionId
    ? zones.filter((zone) => zone.electionId === value.electionId)
    : zones;
  return (
    <div className={styles.filters}>
      <Select
        aria-label="Pleito"
        value={value.electionId}
        onChange={(event) =>
          onChange({ ...value, electionId: event.target.value, zoneId: "" })
        }
      >
        <option value="">Todos os pleitos</option>
        {elections.map((election) => (
          <option key={election.id} value={election.id}>
            {election.name}
          </option>
        ))}
      </Select>
      <Select
        aria-label="Zona"
        value={value.zoneId}
        onChange={(event) => onChange({ ...value, zoneId: event.target.value })}
      >
        <option value="">Todas as zonas</option>
        {visibleZones.map((zone) => (
          <option key={zone.id} value={zone.id}>
            Zona {zone.number}
          </option>
        ))}
      </Select>
      <Select
        aria-label="Município"
        value={value.municipality}
        onChange={(event) =>
          onChange({ ...value, municipality: event.target.value })
        }
      >
        <option value="">Todos os municípios</option>
        {municipalities.map((city) => (
          <option key={city}>{city}</option>
        ))}
      </Select>
      <Select
        aria-label="Status"
        value={value.status}
        onChange={(event) =>
          onChange({
            ...value,
            status: event.target.value as MapFiltersValue["status"],
          })
        }
      >
        <option value="">Todos os status</option>
        {MONITORING_STATUSES.map((status) => (
          <option key={status} value={status}>
            {STATUS_LABELS[status]}
          </option>
        ))}
      </Select>
      <Button onClick={onReset}>Limpar filtros</Button>
    </div>
  );
}
