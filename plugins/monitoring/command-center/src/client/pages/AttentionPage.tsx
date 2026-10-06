import { useMemo, useState } from "react";
import {
  Breadcrumb,
  Card,
  ErrorState,
  LinkButton,
  Loading,
  Select,
  useAsync,
} from "@eops/ui";
import {
  OPERATIONAL_SEVERITY_LABELS,
  OPERATIONAL_SOURCE_LABELS,
  type OperationalAttentionSource,
  type OperationalSeverity,
} from "@eops/shared/command-center";
import { AttentionFeed } from "../components/AttentionFeed";
import { OperationalHealthBanner } from "../components/OperationalHealthBanner";
import { commandCenterService, SOURCE_ORDER } from "../services/commandCenterService";
import styles from "../styles/command-center.module.css";

const STATUS_STATES = [
  "UNACKNOWLEDGED",
  "ESCALATED",
  "BLOCKED",
  "WAITING",
  "IN_PROGRESS",
  "RESOLVED",
] as const;

const SEVERITIES: OperationalSeverity[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

export function AttentionPage() {
  const [electionId, setElectionId] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [severity, setSeverity] = useState<OperationalSeverity | "">("");
  const [sourceType, setSourceType] = useState<OperationalAttentionSource | "">("");
  const [statusState, setStatusState] = useState<string>("");

  const scopeKey = `${electionId}|${zoneId}`;
  const scope = {
    electionId: electionId || undefined,
    electoralZoneId: zoneId || undefined,
  };

  const elections = useAsync(commandCenterService.elections, []);
  const zones = useAsync(() => commandCenterService.zones(scope), [scopeKey]);
  const attention = useAsync(
    () => commandCenterService.attention(scope),
    [scopeKey],
  );

  const items = useMemo(() => {
    const all = [
      ...(attention.data?.criticalItems ?? []),
      ...(attention.data?.warnings ?? []),
    ];
    return all.filter((item) => {
      if (severity && item.severity !== severity) return false;
      if (sourceType && item.sourceType !== sourceType) return false;
      if (statusState && item.statusState !== statusState) return false;
      return true;
    });
  }, [attention.data, severity, sourceType, statusState]);

  return (
    <section className={styles.page}>
      <Breadcrumb
        items={[
          { label: "Central de Comando", to: "/command-center" },
          { label: "Sinais de atenção" },
        ]}
      />
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>FEED UNIFICADO</span>
          <h1>Sinais de atenção</h1>
          <p>
            Incidentes, transmissão, cobertura, preparação, logística e recursos
            ordenados por score determinístico.
          </p>
        </div>
        <div className={styles.headerActions}>
          <LinkButton secondary to="/command-center">
            Voltar ao painel
          </LinkButton>
        </div>
      </header>

      {attention.data && (
        <OperationalHealthBanner
          health={attention.data.health}
          metrics={attention.data.metrics}
        />
      )}

      <Card>
        <div className={styles.filters}>
          <Select
            aria-label="Pleito"
            value={electionId}
            onChange={(event) => {
              setElectionId(event.target.value);
              setZoneId("");
            }}
          >
            <option value="">Todos os pleitos</option>
            {(elections.data ?? []).map((election) => (
              <option key={election.id} value={election.id}>
                {election.name}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Zona"
            value={zoneId}
            onChange={(event) => setZoneId(event.target.value)}
          >
            <option value="">Todas as zonas</option>
            {(zones.data?.zones ?? []).map((zone) => (
              <option key={zone.zoneId} value={zone.zoneId}>
                {zone.zoneNumber} · {zone.zoneName}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Severidade"
            value={severity}
            onChange={(event) =>
              setSeverity(event.target.value as OperationalSeverity | "")
            }
          >
            <option value="">Todas as severidades</option>
            {SEVERITIES.map((value) => (
              <option key={value} value={value}>
                {OPERATIONAL_SEVERITY_LABELS[value]}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Origem"
            value={sourceType}
            onChange={(event) =>
              setSourceType(event.target.value as OperationalAttentionSource | "")
            }
          >
            <option value="">Todas as origens</option>
            {SOURCE_ORDER.map((value) => (
              <option key={value} value={value}>
                {OPERATIONAL_SOURCE_LABELS[value]}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Estado"
            value={statusState}
            onChange={(event) => setStatusState(event.target.value)}
          >
            <option value="">Todos os estados</option>
            {STATUS_STATES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
        </div>
        <p className={styles.muted}>
          {items.length} sinal(is) após filtro · ordem por score, idade e origem
        </p>
      </Card>

      {attention.loading && (
        <Loading label="Agregando sinais operacionais…" />
      )}
      {attention.error && (
        <ErrorState error={attention.error} onRetry={attention.reload} />
      )}
      {attention.data && (
        <Card>
          <AttentionFeed
            items={items}
            emptyTitle="Nenhum sinal corresponde aos filtros"
            emptyDescription="Ajuste os filtros para ampliar a leitura do feed."
            showScore
          />
        </Card>
      )}
    </section>
  );
}
