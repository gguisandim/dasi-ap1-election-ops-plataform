import { Card } from "@eops/ui";
import { formatPercent } from "@eops/shared/format";
import type { RiskDashboard } from "@eops/shared/risks";
import styles from "../styles/risk.module.css";

function share(part: number, total: number): number {
  return total <= 0 ? 0 : Math.round((part / total) * 1000) / 10;
}

/**
 * Cartões do painel de riscos.
 *
 * "Sem mitigação" e "mitigação atrasada" são os dois indicadores que exigem ação:
 * um risco conhecido e não tratado é o pior estado possível do registro.
 */
export function RiskSummaryCards({ dashboard }: { dashboard: RiskDashboard }) {
  return (
    <div className={styles.summaryCards}>
      <Card className={styles.summaryCard}>
        <span>Riscos ativos</span>
        <strong>{dashboard.active}</strong>
        <small>
          {dashboard.total} no total · {dashboard.closed} encerrado(s)
        </small>
      </Card>
      <Card
        className={`${styles.summaryCard} ${dashboard.critical > 0 ? styles.summaryCardCritical : ""}`}
      >
        <span>Críticos</span>
        <strong>{dashboard.critical}</strong>
        <small>
          {dashboard.high} alto(s) · score médio {dashboard.averageScore}
        </small>
      </Card>
      <Card
        className={`${styles.summaryCard} ${dashboard.withoutMitigation > 0 ? styles.summaryCardAlert : ""}`}
      >
        <span>Sem mitigação</span>
        <strong>{dashboard.withoutMitigation}</strong>
        <small>
          {formatPercent(share(dashboard.withoutMitigation, dashboard.total))} dos riscos
        </small>
      </Card>
      <Card
        className={`${styles.summaryCard} ${dashboard.overdueMitigations > 0 ? styles.summaryCardAlert : ""}`}
      >
        <span>Mitigações atrasadas</span>
        <strong>{dashboard.overdueMitigations}</strong>
        <small>Prazo vencido sem conclusão</small>
      </Card>
      <Card className={styles.summaryCard}>
        <span>Materializados</span>
        <strong>{dashboard.materialized}</strong>
        <small>{dashboard.accepted} aceito(s) sem tratamento</small>
      </Card>
    </div>
  );
}

/** Distribuição em barras horizontais proporcionais ao maior valor. */
export function DistributionList({
  title,
  entries,
  emptyLabel = "Sem dados.",
}: {
  title: string;
  entries: Array<{ key: string; label: string; total: number }>;
  emptyLabel?: string;
}) {
  const max = Math.max(1, ...entries.map((entry) => entry.total));
  return (
    <div>
      <h3>{title}</h3>
      {entries.length === 0 ? (
        <p className={styles.mutedText}>{emptyLabel}</p>
      ) : (
        <ul className={styles.distribution}>
          {entries.map((entry) => (
            <li key={entry.key}>
              <span>{entry.label}</span>
              <div className={styles.distributionBar}>
                <span style={{ width: `${(entry.total / max) * 100}%` }} />
              </div>
              <strong>{entry.total}</strong>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
