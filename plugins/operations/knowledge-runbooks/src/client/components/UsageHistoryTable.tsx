import { Link } from "react-router-dom";
import { formatDateTime } from "@eops/shared/format";
import type { RunbookUsageSummary } from "@eops/shared/knowledge";
import { OutcomeBadge } from "./KnowledgeBadges";
import styles from "../styles/knowledge.module.css";

/** Histórico de execuções: quem usou, em qual incidente e com qual resultado. */
export function UsageHistoryTable({
  items,
  showArticle = false,
  emptyLabel = "Nenhuma execução registrada.",
}: {
  items: RunbookUsageSummary[];
  showArticle?: boolean;
  emptyLabel?: string;
}) {
  if (items.length === 0) return <p className={styles.mutedText}>{emptyLabel}</p>;
  return (
    <div className={styles.tableWrap}>
      <table>
        <thead>
          <tr>
            {showArticle && <th>Runbook</th>}
            <th>Incidente</th>
            <th>Executado por</th>
            <th>Resultado</th>
            <th>Passos</th>
            <th>Início</th>
            <th>Fim</th>
            <th>Observações</th>
          </tr>
        </thead>
        <tbody>
          {items.map((usage) => (
            <tr key={usage.id}>
              {showArticle && (
                <td>
                  {usage.article ? (
                    <Link to={`/knowledge/${usage.article.id}`}>{usage.article.code}</Link>
                  ) : (
                    "—"
                  )}
                  <small>{usage.article?.title}</small>
                </td>
              )}
              <td>{usage.incidentCode ?? usage.incidentId ?? "—"}</td>
              <td>{usage.userName}</td>
              <td>
                <OutcomeBadge outcome={usage.outcome} />
                {usage.resolved && <small className={styles.successText}>resolveu</small>}
              </td>
              <td>{usage.stepsCompleted ?? "—"}</td>
              <td>{formatDateTime(usage.startedAt)}</td>
              <td>{usage.finishedAt ? formatDateTime(usage.finishedAt) : "—"}</td>
              <td>{usage.notes ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
