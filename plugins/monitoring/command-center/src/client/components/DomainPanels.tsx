import { Card } from "@eops/ui";
import { formatDateTime } from "@eops/shared/format";
import { Link } from "react-router-dom";
import { formatAge } from "../services/commandCenterService";
import type {
  ContinuitySection,
  LogisticsSection,
  WorkforceSection,
} from "../../types";
import styles from "../styles/command-center.module.css";

function unavailable(label: string) {
  return (
    <Card>
      <div className={styles.sectionTitle}>
        <h2>{label}</h2>
      </div>
      <p className={styles.unavailable}>
        Sem permissão de leitura para este domínio.
      </p>
    </Card>
  );
}

function Rows({
  rows,
}: {
  rows: Array<{ label: string; value: number | string; to?: string }>;
}) {
  return (
    <ul className={styles.panelList}>
      {rows.map((row) => (
        <li key={row.label}>
          <span>{row.label}</span>
          {row.to ? (
            <Link to={row.to}>
              <strong>{row.value}</strong>
            </Link>
          ) : (
            <strong>{row.value}</strong>
          )}
        </li>
      ))}
    </ul>
  );
}

export function WorkforcePanel({ data }: { data: WorkforceSection }) {
  if (!data.available) return unavailable("Força de trabalho");
  return (
    <Card>
      <div className={styles.sectionTitle}>
        <h2>Força de trabalho</h2>
        <Link to="/shifts/coverage">Ver cobertura</Link>
      </div>
      {data.shifts ? (
        <Rows
          rows={[
            { label: "Turnos no horizonte", value: data.shifts.total, to: "/shifts" },
            { label: "Cobertura vazia", value: data.shifts.coverageEmpty },
            { label: "Cobertura parcial", value: data.shifts.coverageCritical },
          ]}
        />
      ) : (
        <p className={styles.unavailable}>Sem permissão para escalas.</p>
      )}
      {data.dispatches ? (
        <Rows
          rows={[
            { label: "Dispatches ativos", value: data.dispatches.active, to: "/field-teams/dispatch" },
            { label: "Aguardando aceite", value: data.dispatches.waiting },
          ]}
        />
      ) : (
        <p className={styles.unavailable}>Sem permissão para operação de campo.</p>
      )}
    </Card>
  );
}

export function LogisticsPanel({ data }: { data: LogisticsSection }) {
  if (!data.available) return unavailable("Logística");
  return (
    <Card>
      <div className={styles.sectionTitle}>
        <h2>Logística</h2>
        <Link to="/routes">Ver rotas</Link>
      </div>
      {data.routes ? (
        <Rows
          rows={[
            { label: "Rotas atrasadas", value: data.routes.delayed },
            { label: "Entregas com falha", value: data.routes.failedDeliveries },
            { label: "Exceções abertas", value: data.routes.openExceptions },
          ]}
        />
      ) : (
        <p className={styles.unavailable}>Sem permissão para rotas.</p>
      )}
      {data.assets ? (
        <Rows
          rows={[
            { label: "Ativos perdidos", value: data.assets.lost, to: "/inventory" },
            { label: "Em manutenção", value: data.assets.inMaintenance },
            { label: "Indisponíveis", value: data.assets.unavailable },
          ]}
        />
      ) : (
        <p className={styles.unavailable}>Sem permissão para inventário.</p>
      )}
    </Card>
  );
}

export function ContinuityPanel({ data }: { data: ContinuitySection }) {
  if (!data.available) return unavailable("Continuidade");
  return (
    <Card>
      <div className={styles.sectionTitle}>
        <h2>Continuidade</h2>
        <Link to="/shift-handovers/list">Ver passagens</Link>
      </div>
      <Rows
        rows={[
          { label: "Passagens pendentes", value: data.pending ?? 0 },
          {
            label: "Pendentes há mais de 24h",
            value: data.oldPending ?? 0,
          },
          {
            label: "Pendência mais antiga",
            value: formatAge(data.oldestPendingAgeSeconds ?? 0),
          },
        ]}
      />
      {data.recentlyConfirmed && data.recentlyConfirmed.length > 0 && (
        <>
          <h3 className={styles.muted}>Confirmadas recentemente</h3>
          <Rows
            rows={data.recentlyConfirmed.map((item) => ({
              label: item.shiftName ?? "Turno",
              value: item.confirmedAt ? formatDateTime(item.confirmedAt) : "—",
              to: `/shift-handovers/${item.id}`,
            }))}
          />
        </>
      )}
    </Card>
  );
}
