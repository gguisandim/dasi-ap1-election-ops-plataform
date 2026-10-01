import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, ErrorState, LinkButton, Loading, Select } from "@eops/ui";
import { RiskMatrix } from "../components/RiskMatrix";
import {
  DistributionList,
  RiskSummaryCards,
} from "../components/RiskSummaryCards";
import { RiskCard } from "../components/RiskCard";
import { useRiskDashboard, useRiskList, useRiskReferenceData } from "../hooks/useRisks";
import styles from "../styles/risk.module.css";

/**
 * Painel de riscos do pleito.
 *
 * Reúne os indicadores que exigem ação (sem mitigação, atraso, críticos), a matriz
 * 5×5 e as distribuições por categoria e por zona.
 */
export function RiskDashboardPage() {
  const [electionId, setElectionId] = useState("");
  const references = useRiskReferenceData();
  const dashboard = useRiskDashboard(electionId || undefined);
  const critical = useRiskList({
    electionId: electionId || undefined,
    status: undefined,
    level: "CRITICAL",
    pageSize: 6,
  });

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>OPERAÇÕES</span>
          <h1>Gestão de Riscos</h1>
          <p>
            Score = probabilidade × impacto, em faixas publicadas. A matriz é a mesma
            regra do registro, não uma segunda tabela de decisão.
          </p>
        </div>
        <div className={styles.headerActions}>
          <LinkButton to="/risks/list" secondary>
            Lista
          </LinkButton>
          <LinkButton to="/risks/matrix" secondary>
            Matriz
          </LinkButton>
          <LinkButton to="/risks/categories" secondary>
            Categorias
          </LinkButton>
          <LinkButton to="/risks/new">Novo risco</LinkButton>
        </div>
      </header>

      <div className={styles.dashboardControls}>
        <Select
          aria-label="Pleito"
          value={electionId}
          onChange={(event) => setElectionId(event.target.value)}
        >
          <option value="">Todos os pleitos</option>
          {(references.data?.elections ?? []).map((election) => (
            <option key={election.id} value={election.id}>
              {election.name}
            </option>
          ))}
        </Select>
      </div>

      {dashboard.loading && <Loading label="Carregando indicadores…" />}
      {dashboard.error && <ErrorState error={dashboard.error} onRetry={dashboard.reload} />}

      {dashboard.data && (
        <>
          <RiskSummaryCards dashboard={dashboard.data} />

          <Card>
            <h2>Matriz de risco</h2>
            <RiskMatrix
              matrix={dashboard.data.matrix}
              onCellSelect={(cell) => {
                window.location.assign(
                  `/risks/list?matrixProbability=${cell.probability}&matrixImpact=${cell.impact}`,
                );
              }}
            />
          </Card>

          <div className={styles.dashboardGrid}>
            <Card>
              <h2>Riscos críticos</h2>
              {critical.loading && <Loading label="Carregando críticos…" />}
              {critical.data?.items.length === 0 && (
                <p className={styles.mutedText}>Nenhum risco em classificação crítica.</p>
              )}
              <div className={styles.cardList}>
                {(critical.data?.items ?? []).map((risk) => (
                  <RiskCard key={risk.id} risk={risk} />
                ))}
              </div>
              <Link className={styles.inlineLink} to="/risks/list?level=CRITICAL">
                Ver todos os críticos
              </Link>
            </Card>

            <Card>
              <h2>Distribuições</h2>
              <DistributionList title="Por categoria" entries={dashboard.data.byCategory} />
              <DistributionList
                title="Por zona"
                entries={dashboard.data.byZone}
                emptyLabel="Nenhum risco vinculado a zona."
              />
              <DistributionList title="Por classificação" entries={dashboard.data.byLevel} />
              <DistributionList title="Por situação" entries={dashboard.data.byStatus} />
            </Card>
          </div>
        </>
      )}
    </section>
  );
}
