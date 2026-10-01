import { Link } from "react-router-dom";
import { formatDateTime } from "@eops/shared/format";
import type { KnowledgeArticleSummary } from "@eops/shared/knowledge";
import { KindBadge, StatusBadge } from "./KnowledgeBadges";
import styles from "../styles/knowledge.module.css";

/**
 * Tabela da base.
 *
 * A coluna de uso mostra taxa de sucesso e volume — é o que distingue um runbook
 * que resolve de um runbook que apenas existe.
 */
export function KnowledgeTable({ items }: { items: KnowledgeArticleSummary[] }) {
  return (
    <div className={styles.tableWrap}>
      <table>
        <thead>
          <tr>
            <th>Código</th>
            <th>Verbete</th>
            <th>Tipo</th>
            <th>Situação</th>
            <th>Associação</th>
            <th>Passos</th>
            <th>Uso</th>
            <th>Atualizado</th>
          </tr>
        </thead>
        <tbody>
          {items.map((article) => (
            <tr key={article.id} className={article.stale ? styles.staleRow : undefined}>
              <td>
                <Link to={`/knowledge/${article.id}`}>{article.code}</Link>
              </td>
              <td>
                <strong>{article.title}</strong>
                <small>{article.summary}</small>
                {article.tags.length > 0 && (
                  <small>{article.tags.map((tag) => tag.label).join(" · ")}</small>
                )}
              </td>
              <td>
                <KindBadge kind={article.kind} />
              </td>
              <td>
                <StatusBadge status={article.status} />
                {article.stale && <small className={styles.warningText}>desatualizado</small>}
              </td>
              <td>
                {article.incidentCategoryKey ? (
                  <small>{article.incidentCategoryKey}</small>
                ) : (
                  <span className={styles.mutedText}>—</span>
                )}
                {article.incidentSeverity && <small>{article.incidentSeverity}</small>}
                {article.assetTypeKey && <small>{article.assetTypeKey}</small>}
              </td>
              <td>{article.kind === "RUNBOOK" ? (article.stepCount ?? 0) : "—"}</td>
              <td>
                {article.kind === "RUNBOOK" ? (
                  <>
                    <strong>{article.usageCount}</strong>
                    <small>
                      {article.resolvedCount} resolvido(s) · {article.successRate}%
                    </small>
                  </>
                ) : (
                  <small>{article.views} leitura(s)</small>
                )}
              </td>
              <td>{formatDateTime(article.updatedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
