import { EmptyState } from "@eops/ui";
import type { OperationalZoneSituation } from "@eops/shared/command-center";
import { Link } from "react-router-dom";
import { HealthPill } from "./OperationalBadges";
import styles from "../styles/command-center.module.css";

function cell(value: number | null) {
  if (value === null) return <span className={styles.muted}>—</span>;
  if (value === 0) return <span className={styles.muted}>0</span>;
  return <span>{value}</span>;
}

export function ZoneMatrix({
  zones,
  onSelectZone,
}: {
  zones: OperationalZoneSituation[];
  onSelectZone?: (zoneId: string) => void;
}) {
  if (zones.length === 0)
    return (
      <EmptyState
        title="Nenhuma zona no escopo"
        description="Selecione um pleito para visualizar a situação por zona eleitoral."
      />
    );
  return (
    <div className={styles.tableWrap}>
      <table>
        <thead>
          <tr>
            <th>Zona</th>
            <th>Saúde</th>
            <th className={styles.numeric}>Incidentes</th>
            <th className={styles.numeric}>Transmissão</th>
            <th className={styles.numeric}>Cobertura vazia</th>
            <th className={styles.numeric}>Dispatches</th>
            <th className={styles.numeric}>Preparação</th>
            <th className={styles.numeric}>Rotas</th>
            <th className={styles.numeric}>Recursos</th>
            <th className={styles.numeric}>Atenção</th>
          </tr>
        </thead>
        <tbody>
          {zones.map((zone) => (
            <tr key={zone.zoneId}>
              <td>
                {onSelectZone ? (
                  <button type="button" onClick={() => onSelectZone(zone.zoneId)}>
                    {zone.zoneNumber} · {zone.zoneName}
                  </button>
                ) : (
                  <Link to={`/electoral-zones/${zone.zoneId}`}>
                    {zone.zoneNumber} · {zone.zoneName}
                  </Link>
                )}
                <small className={styles.muted}>
                  {zone.municipality}/{zone.state}
                </small>
              </td>
              <td>
                <HealthPill health={zone.health} />
              </td>
              <td className={styles.numeric}>{cell(zone.activeIncidents)}</td>
              <td className={styles.numeric}>{cell(zone.transmissionProblems)}</td>
              <td className={styles.numeric}>{cell(zone.coverageEmptyShifts)}</td>
              <td className={styles.numeric}>{cell(zone.waitingDispatches)}</td>
              <td className={styles.numeric}>{cell(zone.preparationBlockers)}</td>
              <td className={styles.numeric}>{cell(zone.routesDelayed)}</td>
              <td className={styles.numeric}>{cell(zone.resourceRequestsOpen)}</td>
              <td
                className={`${styles.numeric} ${
                  zone.criticalItemCount > 0 ? styles.criticalCell : ""
                }`}
              >
                {zone.criticalItemCount > 0
                  ? `${zone.criticalItemCount} crítico(s)`
                  : zone.itemCount}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
