import { Card } from "@eops/ui";
import { formatPercent } from "@eops/shared/format";
import type { KnowledgeDashboard } from "@eops/shared/knowledge";
import styles from "../styles/knowledge.module.css";

/** Cartões do painel: volume, curadoria pendente e saúde do acervo. */
export function KnowledgeSummaryCards({ dashboard }: { dashboard: KnowledgeDashboard }) {
  const uncovered = dashboard.coverage.filter((entry) => entry.runbooks === 0);

  return (
    <div className={styles.summaryCards}>
      <Card className={styles.summaryCard}>
        <span>Base</span>
        <strong>{dashboard.total}</strong>
        <small>
          {dashboard.articles} artigo(s) · {dashboard.runbooks} runbook(s)
        </small>
      </Card>
      <Card className={styles.summaryCard}>
        <span>Publicados</span>
        <strong>{dashboard.published}</strong>
        <small>
          {dashboard.drafts} rascunho(s) · {dashboard.review} em revisão
        </small>
      </Card>
      <Card
        className={`${styles.summaryCard} ${dashboard.staleRunbooks > 0 ? styles.summaryCardAlert : ""}`}
      >
        <span>Desatualizados</span>
        <strong>{dashboard.staleRunbooks}</strong>
        <small>{dashboard.unusedPublished} publicado(s) sem uso</small>
      </Card>
      <Card className={styles.summaryCard}>
        <span>Taxa de sucesso</span>
        <strong>{formatPercent(dashboard.successRate)}</strong>
        <small>{dashboard.totalUsages} execução(ões) registrada(s)</small>
      </Card>
      <Card className={styles.summaryCard}>
        <span>Categorias sem cobertura</span>
        <strong>{uncovered.length}</strong>
        <small>
          {uncovered.length === 0
            ? "Toda categoria tem runbook publicado"
            : uncovered
                .slice(0, 3)
                .map((entry) => entry.name)
                .join(", ")}
        </small>
      </Card>
    </div>
  );
}
