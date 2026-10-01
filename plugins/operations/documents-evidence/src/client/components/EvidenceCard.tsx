import { Link } from "react-router-dom";
import { formatDateTime } from "@eops/shared/format";
import type { EvidenceSummary } from "@eops/shared/evidence";
import { EvidenceChip, EvidenceLinkBadge, EvidenceStatusBadge, EvidenceTypeBadge } from "./EvidenceBadges";
import { EvidenceThumbnail } from "./EvidenceThumbnail";
import styles from "../styles/evidence.module.css";
import { checksumPrefix, formatBytes } from "../utils/format";

export function EvidenceCard({
  evidence,
  onOpen,
}: {
  evidence: EvidenceSummary;
  onOpen?: (evidence: EvidenceSummary) => void;
}) {
  const title = (
    <Link to={`/evidence/${evidence.id}`}>{evidence.title}</Link>
  );

  return (
    <article className={styles.card}>
      <button
        type="button"
        className={styles.cardThumb}
        onClick={() => onOpen?.(evidence)}
        disabled={!onOpen}
        aria-label={onOpen ? `Ampliar ${evidence.title}` : undefined}
      >
        <EvidenceThumbnail
          evidenceId={evidence.id}
          type={evidence.type}
          extension={evidence.version?.extension}
          size={150}
        />
      </button>
      <header>
        <span className={styles.code}>{evidence.code}</span>
        <EvidenceTypeBadge type={evidence.type} />
      </header>
      <h3>{title}</h3>
      {evidence.description && <p className={styles.clamp}>{evidence.description}</p>}
      <div className={styles.cardBadges}>
        <EvidenceStatusBadge status={evidence.status} />
        {evidence.version && (
          <EvidenceChip label={`v${evidence.version.number}`} />
        )}
        {evidence.version && <EvidenceChip label={formatBytes(evidence.version.size)} />}
      </div>
      {evidence.links.length > 0 && (
        <div className={styles.cardLinks}>
          {evidence.links.slice(0, 2).map((link) => (
            <EvidenceLinkBadge key={link.id} type={link.type} />
          ))}
          {evidence.links.length > 2 && <small>+{evidence.links.length - 2}</small>}
        </div>
      )}
      <footer>
        <span>{evidence.authorName}</span>
        <span>{formatDateTime(evidence.capturedAt ?? evidence.createdAt)}</span>
      </footer>
      {evidence.version && (
        <code className={styles.checksum}>{checksumPrefix(evidence.version.checksum)}</code>
      )}
    </article>
  );
}
