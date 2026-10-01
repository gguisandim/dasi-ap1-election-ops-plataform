import { formatDateTime } from "@eops/shared/format";
import type { KnowledgeArticleVersionSummary } from "@eops/shared/knowledge";
import styles from "../styles/knowledge.module.css";

/**
 * Histórico de versões.
 *
 * Cada versão é um instantâneo: guarda o texto e os passos como estavam no
 * momento da alteração, para que o histórico não aponte para o conteúdo atual.
 */
export function VersionHistoryTable({
  versions,
  currentVersion,
  onPreview,
}: {
  versions: KnowledgeArticleVersionSummary[];
  currentVersion: number;
  onPreview: (version: KnowledgeArticleVersionSummary) => void;
}) {
  if (versions.length === 0) {
    return <p className={styles.mutedText}>Nenhuma versão registrada.</p>;
  }
  return (
    <div className={styles.tableWrap}>
      <table>
        <thead>
          <tr>
            <th>Versão</th>
            <th>Nota da alteração</th>
            <th>Autor</th>
            <th>Data</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {versions.map((version) => (
            <tr
              key={version.id}
              className={version.number === currentVersion ? styles.currentRow : undefined}
            >
              <td>
                <strong>v{version.number}</strong>
                {version.number === currentVersion && (
                  <small className={styles.successText}>atual</small>
                )}
              </td>
              <td>{version.note}</td>
              <td>{version.authorName}</td>
              <td>{formatDateTime(version.createdAt)}</td>
              <td>
                <button
                  type="button"
                  className={styles.linkButton}
                  onClick={() => onPreview(version)}
                >
                  Ver conteúdo
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
