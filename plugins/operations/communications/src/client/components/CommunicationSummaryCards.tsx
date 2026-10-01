import type { CommunicationDashboard } from "@eops/shared/communications";
import { formatPercent } from "@eops/shared/format";
import { Card } from "@eops/ui";
import styles from "../styles/communications.module.css";

/**
 * Cartões do painel: volume, prioridade e qualidade do acompanhamento.
 */
export function CommunicationSummaryCards({
  dashboard,
}: {
  dashboard: CommunicationDashboard;
}) {
  return (
    <div className={styles.summaryCards}>
      <Card className={styles.summaryCard}>
        <span>Publicados</span>
        <strong>{dashboard.published}</strong>
        <small>{dashboard.scheduled} agendado(s) · {dashboard.drafts} rascunho(s)</small>
      </Card>
      <Card className={`${styles.summaryCard} ${dashboard.urgent > 0 ? styles.summaryCardUrgent : ""}`}>
        <span>Prioritários</span>
        <strong>{dashboard.urgent}</strong>
        <small>{dashboard.critical} em prioridade crítica</small>
      </Card>
      <Card className={styles.summaryCard}>
        <span>Confirmações pendentes</span>
        <strong>{dashboard.pendingConfirmations}</strong>
        <small>{dashboard.expired} expirado(s)</small>
      </Card>
      <Card className={styles.summaryCard}>
        <span>Taxa de leitura</span>
        <strong>{formatPercent(dashboard.readRate)}</strong>
        <small>Comunicados publicados e expirados</small>
      </Card>
      <Card className={styles.summaryCard}>
        <span>Taxa de confirmação</span>
        <strong>{formatPercent(dashboard.confirmationRate)}</strong>
        <small>Confirmados sobre o total distribuído</small>
      </Card>
    </div>
  );
}
