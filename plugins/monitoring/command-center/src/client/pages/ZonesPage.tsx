import { useState } from "react";
import {
  Breadcrumb,
  Card,
  ErrorState,
  LinkButton,
  Loading,
  Select,
  useAsync,
} from "@eops/ui";
import { ZoneMatrix } from "../components/ZoneMatrix";
import { commandCenterService } from "../services/commandCenterService";
import styles from "../styles/command-center.module.css";

export function ZonesPage() {
  const [electionId, setElectionId] = useState("");
  const scopeKey = electionId;
  const scope = { electionId: electionId || undefined };
  const elections = useAsync(commandCenterService.elections, []);
  const zones = useAsync(() => commandCenterService.zones(scope), [scopeKey]);

  const totalCritical = (zones.data?.zones ?? []).reduce(
    (total, zone) => total + zone.criticalItemCount,
    0,
  );

  return (
    <section className={styles.page}>
      <Breadcrumb
        items={[
          { label: "Central de Comando", to: "/command-center" },
          { label: "Zonas" },
        ]}
      />
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>MATRIZ TERRITORIAL</span>
          <h1>Situação por zona eleitoral</h1>
          <p>
            Health, incidentes, transmissão, cobertura, preparação, logística e
            recursos por zona. Campos sem permissão aparecem como indisponíveis.
          </p>
        </div>
        <div className={styles.headerActions}>
          <LinkButton secondary to="/command-center">
            Voltar ao painel
          </LinkButton>
        </div>
      </header>

      <Card>
        <div className={styles.filters}>
          <Select
            aria-label="Pleito"
            value={electionId}
            onChange={(event) => setElectionId(event.target.value)}
          >
            <option value="">Todos os pleitos</option>
            {(elections.data ?? []).map((election) => (
              <option key={election.id} value={election.id}>
                {election.name}
              </option>
            ))}
          </Select>
        </div>
        <p className={styles.muted}>
          {zones.data ? `${zones.data.zones.length} zona(s)` : "—"} ·{" "}
          {totalCritical} item(ns) crítico(s) agregado(s)
        </p>
      </Card>

      {zones.loading && <Loading label="Agregando situação por zona…" />}
      {zones.error && <ErrorState error={zones.error} onRetry={zones.reload} />}
      {zones.data && <ZoneMatrix zones={zones.data.zones} />}
    </section>
  );
}
