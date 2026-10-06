import { useState } from "react";
import { Card, ErrorState, LinkButton, Loading, Select, useAsync } from "@eops/ui";
import { useSearchParams } from "react-router-dom";
import { AttentionFeed } from "../components/AttentionFeed";
import {
  ContinuityPanel,
  LogisticsPanel,
  WorkforcePanel,
} from "../components/DomainPanels";
import { OperationalHealthBanner } from "../components/OperationalHealthBanner";
import { Wallboard } from "../components/Wallboard";
import { ZoneMatrix } from "../components/ZoneMatrix";
import { useOperationalSummary } from "../hooks/useOperationalSummary";
import { commandCenterService } from "../services/commandCenterService";
import type {
  ContinuitySection,
  LogisticsSection,
  WorkforceSection,
} from "../../types";
import styles from "../styles/command-center.module.css";

const FORBIDDEN_WORKFORCE: WorkforceSection = {
  available: false,
  reason: "FORBIDDEN",
  shifts: null,
  dispatches: null,
};
const FORBIDDEN_LOGISTICS: LogisticsSection = {
  available: false,
  reason: "FORBIDDEN",
  routes: null,
  assets: null,
};
const FORBIDDEN_CONTINUITY: ContinuitySection = {
  available: false,
  reason: "FORBIDDEN",
};

export function CommandCenterPage() {
  const [searchParams] = useSearchParams();
  const [electionId, setElectionId] = useState(
    () => searchParams.get("electionId") ?? "",
  );
  const [zoneId, setZoneId] = useState(
    () => searchParams.get("electoralZoneId") ?? "",
  );
  const [viewId, setViewId] = useState("");
  const wallboard = searchParams.get("mode") === "wallboard";
  const scopeKey = `${electionId}|${zoneId}`;

  const scope = {
    electionId: electionId || undefined,
    electoralZoneId: zoneId || undefined,
  };

  const elections = useAsync(commandCenterService.elections, []);
  const views = useAsync(commandCenterService.views, []);
  const zones = useAsync(
    () => commandCenterService.zones(scope),
    [scopeKey],
  );
  const workforce = useAsync<WorkforceSection>(
    () => commandCenterService.workforce(scope),
    [scopeKey],
  );
  const logistics = useAsync<LogisticsSection>(
    () => commandCenterService.logistics(scope),
    [scopeKey],
  );
  const continuity = useAsync<ContinuitySection>(
    () => commandCenterService.continuity(scope),
    [scopeKey],
  );

  const activeView = views.data?.find((view) => view.id === viewId);
  const refreshSeconds = activeView?.refreshSeconds ?? 45;
  const summary = useOperationalSummary(scope, refreshSeconds, true);

  if (wallboard) {
    if (summary.loading && !summary.data)
      return (
        <section className={styles.page}>
          <Loading label="Carregando painel de situação…" />
        </section>
      );
    if (summary.error && !summary.data)
      return (
        <section className={styles.page}>
          <ErrorState error={summary.error} onRetry={summary.reload} />
        </section>
      );
    if (!summary.data) return null;
    return (
      <section className={styles.page}>
        <Wallboard
          summary={summary.data}
          zones={zones.data?.zones ?? []}
          refreshing={summary.refreshing}
        />
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>MONITORAMENTO</span>
          <h1>Central de Comando</h1>
          <p>
            Estado operacional atual do pleito, agregado por domínio e por zona
            eleitoral.
          </p>
        </div>
        <div className={styles.headerActions}>
          <LinkButton secondary to="/command-center/attention">
            Todos os sinais
          </LinkButton>
          <LinkButton secondary to="/command-center/zones">
            Matriz de zonas
          </LinkButton>
          <LinkButton secondary to="/command-center/views">
            Visões salvas
          </LinkButton>
          <LinkButton secondary to="/command-center/snapshots">
            Snapshots
          </LinkButton>
          <LinkButton
            to={`/command-center?mode=wallboard${
              electionId ? `&electionId=${electionId}` : ""
            }`}
          >
            Modo painel
          </LinkButton>
        </div>
      </header>

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
          aria-label="Zona eleitoral"
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
          aria-label="Visão salva"
          value={viewId}
          onChange={(event) => {
            setViewId(event.target.value);
            const next = views.data?.find(
              (view) => view.id === event.target.value,
            );
            if (next?.filters.electionId) setElectionId(next.filters.electionId);
            if (next?.filters.electoralZoneId)
              setZoneId(next.filters.electoralZoneId);
          }}
        >
          <option value="">Intervalo padrão (45s)</option>
          {(views.data ?? []).map((view) => (
            <option key={view.id} value={view.id}>
              {view.name} · {view.refreshSeconds}s
            </option>
          ))}
        </Select>
      </div>

      {summary.loading && !summary.data && (
        <Loading label="Consolidando situação operacional…" />
      )}
      {summary.error && !summary.data && (
        <ErrorState error={summary.error} onRetry={summary.reload} />
      )}

      {summary.data && (
        <>
          <OperationalHealthBanner
            health={summary.data.health}
            metrics={summary.data.metrics}
          />
          <div className={styles.layout}>
            <Card>
              <div className={styles.sectionTitle}>
                <h2>Atenção crítica</h2>
                <span className={styles.muted}>
                  {summary.refreshing
                    ? "atualizando…"
                    : `atualização a cada ${refreshSeconds}s`}
                </span>
              </div>
              <AttentionFeed
                items={summary.data.criticalItems.slice(0, 8)}
                emptyTitle="Nenhum item crítico"
                emptyDescription="Nenhum sinal crítico no escopo selecionado."
                showScore
              />
              {summary.data.warnings.length > 0 && (
                <>
                  <h3 className={styles.muted}>Avisos</h3>
                  <AttentionFeed
                    items={summary.data.warnings.slice(0, 5)}
                    emptyTitle="Sem avisos"
                    emptyDescription="Nenhum aviso operacional no escopo."
                  />
                </>
              )}
            </Card>
            <div className={styles.stack}>
              <Card>
                <div className={styles.sectionTitle}>
                  <h2>Resumo operacional</h2>
                </div>
                <ul className={styles.panelList}>
                  {metricRows(summary.data.metrics).map((row) => (
                    <li key={row.label}>
                      <span>{row.label}</span>
                      <strong>
                        {row.value === null ? "indisponível" : row.value}
                      </strong>
                    </li>
                  ))}
                </ul>
              </Card>
              <WorkforcePanel data={workforce.data ?? FORBIDDEN_WORKFORCE} />
              <ContinuityPanel data={continuity.data ?? FORBIDDEN_CONTINUITY} />
              <LogisticsPanel data={logistics.data ?? FORBIDDEN_LOGISTICS} />
            </div>
          </div>

          <div className={styles.stack}>
            <Card>
              <div className={styles.sectionTitle}>
                <h2>Situação por zona</h2>
                <span className={styles.muted}>
                  Zonas mais críticas primeiro
                </span>
              </div>
              <ZoneMatrix
                zones={(zones.data?.zones ?? []).slice(0, 12)}
                onSelectZone={setZoneId}
              />
            </Card>
          </div>
        </>
      )}
    </section>
  );
}

function metricRows(metrics: {
  transmissionFailures: number | null;
  transmissionOffline: number | null;
  shiftsCoverageEmpty: number | null;
  waitingDispatches: number | null;
  preparationBlocked: number | null;
  routesDelayed: number | null;
  assetsLost: number | null;
  resourceRequestsOverdue: number | null;
}) {
  return [
    { label: "Falhas de transmissão", value: metrics.transmissionFailures },
    { label: "Pontos offline", value: metrics.transmissionOffline },
    { label: "Turnos sem cobertura", value: metrics.shiftsCoverageEmpty },
    { label: "Dispatches aguardando", value: metrics.waitingDispatches },
    { label: "Bloqueios de preparação", value: metrics.preparationBlocked },
    { label: "Rotas atrasadas", value: metrics.routesDelayed },
    { label: "Ativos perdidos", value: metrics.assetsLost },
    { label: "Recursos vencidos", value: metrics.resourceRequestsOverdue },
  ];
}
