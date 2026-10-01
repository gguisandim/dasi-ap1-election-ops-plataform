import { Link } from "react-router-dom";
import { formatDateTime } from "@eops/shared/format";
import type { EvidenceSummary } from "@eops/shared/evidence";
import { EvidenceStatusBadge, EvidenceTypeBadge } from "./EvidenceBadges";
import { EvidenceThumbnail } from "./EvidenceThumbnail";
import styles from "../styles/evidence.module.css";
import { checksumPrefix, extensionLabel, formatBytes } from "../utils/format";

/**
 * Tabela do acervo.
 *
 * A coluna de integridade mostra o prefixo do checksum SHA-256 da versão
 * corrente — é o que permite conferir manualmente que o arquivo não mudou.
 */
export function EvidenceTable({ items }: { items: EvidenceSummary[] }) {
  return (
    <div className={styles.tableWrap}>
      <table>
        <thead>
          <tr>
            <th>Arquivo</th>
            <th>Evidência</th>
            <th>Tipo</th>
            <th>Situação</th>
            <th>Vínculos</th>
            <th>Autor</th>
            <th>Registrado em</th>
            <th>Integridade</th>
          </tr>
        </thead>
        <tbody>
          {items.map((evidence) => (
            <tr key={evidence.id}>
              <td className={styles.thumbCell}>
                <EvidenceThumbnail
                  evidenceId={evidence.id}
                  type={evidence.type}
                  extension={evidence.version?.extension}
                  size={62}
                />
              </td>
              <td>
                <Link to={`/evidence/${evidence.id}`}>{evidence.code}</Link>
                <strong>{evidence.title}</strong>
                {evidence.tags.length > 0 && (
                  <small>{evidence.tags.map((tag) => tag.label).join(" · ")}</small>
                )}
              </td>
              <td>
                <EvidenceTypeBadge type={evidence.type} />
              </td>
              <td>
                <EvidenceStatusBadge status={evidence.status} />
              </td>
              <td>
                {evidence.links.length === 0 ? (
                  <span className={styles.mutedText}>sem vínculo</span>
                ) : (
                  evidence.links.slice(0, 2).map((link) => (
                    <small key={link.id}>{link.targetLabel ?? link.targetId}</small>
                  ))
                )}
                {evidence.links.length > 2 && (
                  <small className={styles.mutedText}>+{evidence.links.length - 2}</small>
                )}
              </td>
              <td>{evidence.authorName}</td>
              <td>{formatDateTime(evidence.capturedAt ?? evidence.createdAt)}</td>
              <td>
                {evidence.version ? (
                  <>
                    <code className={styles.checksum}>
                      {checksumPrefix(evidence.version.checksum)}
                    </code>
                    <small>
                      v{evidence.version.number} · {formatBytes(evidence.version.size)} ·{" "}
                      {extensionLabel(evidence.version.extension)}
                    </small>
                  </>
                ) : (
                  <span className={styles.dangerText}>sem arquivo</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
