import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, EmptyState, ErrorState, LinkButton, Loading, Select, useAsync } from "@eops/ui";
import { formatPercent } from "@eops/shared/format";
import { CommunicationCard } from "../components/CommunicationCard";
import { CommunicationSummaryCards } from "../components/CommunicationSummaryCards";
import { MetricBarLegend } from "../components/MetricBar";
import { communicationService } from "../services/communicationService";
import { useAutoRefresh } from "../hooks/useCommunications";
import styles from "../styles/communications.module.css";

const REFRESH_OPTIONS = [
  { value: 0, label: "Manual" },
  { value: 30_000, label: "30 segundos" },
  { value: 60_000, label: "1 minuto" },
];

/**
 * Painel de comunicações: volume, prioridade, pendências e qualidade do
 * acompanhamento, mais os comunicados que exigem atenção imediata.
 */
export function CommunicationDashboardPage() {
  const [electionId, setElectionId] = useState("");
  const [refreshMs, setRefreshMs] = useState(60_000);
  const elections = useAsync(() => communicationService.referenceData(), []);

  const dashboard = useAsync(
    () => communicationService.dashboard(electionId || undefined),
    [electionId],
  );
  const urgent = useAsync(
    () =>
      communicationService.list({
        urgentOnly: true,
        status: "PUBLISHED",
        electionId: electionId || undefined,
        pageSize: 6,
      }),
    [electionId],
  );
  const recent = useAsync(
    () =>
      communicationService.list({
        status: "PUBLISHED",
        electionId: electionId || undefined,
        pageSize: 6,
      }),
    [electionId],
  );

  const reloadAll = () => {
    dashboard.reload();
    urgent.reload();
    recent.reload();
  };
  useAutoRefresh(reloadAll, refreshMs);

  const error = dashboard.error ?? urgent.error ?? recent.error;

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>OPERAÇÕES</span>
          <h1>Comunicações Operacionais</h1>
          <p>Comunicados oficiais, priorização e confirmação de leitura.</p>
        </div>
        <div className={styles.headerActions}>
          <LinkButton to="/communications/inbox" secondary>
            Minha caixa
          </LinkButton>
          <LinkButton to="/communications/messages">Comunicados</LinkButton>
          <LinkButton to="/communications/messages/new">Novo comunicado</LinkButton>
        </div>
      </header>

      <div className={styles.dashboardControls}>
        <Select
          aria-label="Pleito"
          value={electionId}
          onChange={(event) => setElectionId(event.target.value)}
        >
          <option value="">Todos os pleitos</option>
          {(elections.data?.elections ?? []).map((election) => (
            <option key={election.id} value={election.id}>
              {election.name}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Atualização automática"
          value={String(refreshMs)}
          onChange={(event) => setRefreshMs(Number(event.target.value))}
        >
          {REFRESH_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              Atualizar: {option.label}
            </option>
          ))}
        </Select>
      </div>

      {error && <ErrorState error={error} onRetry={reloadAll} />}
      {!dashboard.data && dashboard.loading && <Loading label="Carregando indicadores…" />}

      {dashboard.data && (
        <>
          <CommunicationSummaryCards dashboard={dashboard.data} />

          <div className={styles.dashboardGrid}>
            <Card>
              <h2>Prioritários publicados</h2>
              {urgent.loading && <Loading label="Carregando prioritários…" />}
              {urgent.data?.items.length === 0 && (
                <p className={styles.mutedText}>
                  Nenhum comunicado de alta prioridade publicado.
                </p>
              )}
              <div className={styles.cardList}>
                {(urgent.data?.items ?? []).map((communication) => (
                  <CommunicationCard key={communication.id} communication={communication} />
                ))}
              </div>
            </Card>

            <Card>
              <h2>Publicados recentemente</h2>
              {recent.data?.items.length === 0 && (
                <p className={styles.mutedText}>Nenhum comunicado publicado ainda.</p>
              )}
              <div className={styles.cardList}>
                {(recent.data?.items ?? []).map((communication) => (
                  <CommunicationCard key={communication.id} communication={communication} />
                ))}
              </div>
            </Card>

            <Card>
              <h2>Distribuição por categoria</h2>
              {dashboard.data.topCategories.length === 0 ? (
                <p className={styles.mutedText}>Sem dados de categoria.</p>
              ) : (
                <ul className={styles.categoryRanking}>
                  {dashboard.data.topCategories.map((category) => (
                    <li key={category.categoryId ?? "none"}>
                      <span>{category.name}</span>
                      <strong>{category.total}</strong>
                    </li>
                  ))}
                </ul>
              )}
              <h3>Confirmação</h3>
              <p className={styles.mutedText}>
                {dashboard.data.pendingConfirmations} destinatário(s) ainda não confirmaram
                leitura. Taxa de confirmação atual: {formatPercent(dashboard.data.confirmationRate)}.
              </p>
              <MetricBarLegend />
              <Link className={styles.inlineLink} to="/communications/messages?status=PUBLISHED">
                Ver todos os publicados
              </Link>
            </Card>
          </div>
        </>
      )}

      {dashboard.data && dashboard.data.published === 0 && dashboard.data.drafts === 0 && (
        <EmptyState
          title="Nenhum comunicado ainda"
          description="Crie o primeiro comunicado operacional para começar a acompanhar leitura e confirmação."
          action={<LinkButton to="/communications/messages/new">Novo comunicado</LinkButton>}
        />
      )}
    </section>
  );
}
