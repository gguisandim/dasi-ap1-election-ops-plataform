import { Link } from "react-router-dom";
import { formatDateTime } from "@eops/shared/format";
import type { KnowledgeArticleSummary } from "@eops/shared/knowledge";
import { KindBadge, KnowledgeChip, StatusBadge } from "./KnowledgeBadges";
import styles from "../styles/knowledge.module.css";
import { KIND_ICONS } from "../utils/presentation";

export function KnowledgeCard({ article }: { article: KnowledgeArticleSummary }) {
  return (
    <article className={`${styles.card} ${article.stale ? styles.cardStale : ""}`}>
      <header>
        <span className={styles.code}>{article.code}</span>
        <KindBadge kind={article.kind} />
      </header>
      <h3>
        <Link to={`/knowledge/${article.id}`}>{article.title}</Link>
      </h3>
      <p className={styles.clamp}>{article.summary}</p>
      <div className={styles.cardBadges}>
        <StatusBadge status={article.status} />
        {article.kind === "RUNBOOK" && (
          <KnowledgeChip label={`${article.stepCount ?? 0} passo(s)`} icon={KIND_ICONS.RUNBOOK} />
        )}
        {article.kind === "RUNBOOK" && article.usageCount > 0 && (
          <KnowledgeChip label={`${article.successRate}% de sucesso`} />
        )}
        {article.category && <KnowledgeChip label={article.category.name} />}
      </div>
      {article.stale && (
        <small className={styles.warningText}>
          Sem atualização há mais de 180 dias — revise antes de usar.
        </small>
      )}
      <footer>
        <span>{article.authorName}</span>
        <span>{formatDateTime(article.updatedAt)}</span>
      </footer>
    </article>
  );
}
