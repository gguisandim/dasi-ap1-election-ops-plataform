import { EmptyState } from "@eops/ui";
import { formatDateTime } from "@eops/shared/format";
import type { OperationalAttentionItem } from "@eops/shared/command-center";
import { Link } from "react-router-dom";
import { formatAge } from "../services/commandCenterService";
import { ItemTags, SeverityMark } from "./OperationalBadges";
import styles from "../styles/command-center.module.css";

export function AttentionFeed({
  items,
  emptyTitle = "Nenhum item exige atenção",
  emptyDescription = "A operação está sem sinais críticos neste escopo.",
  showScore = false,
}: {
  items: OperationalAttentionItem[];
  emptyTitle?: string;
  emptyDescription?: string;
  showScore?: boolean;
}) {
  if (items.length === 0)
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  return (
    <ul className={styles.feed}>
      {items.map((item) => (
        <li key={item.id} className={styles.feedItem}>
          <SeverityMark severity={item.severity} />
          <div>
            <Link to={item.deepLink}>{item.title}</Link>
            <p>{item.summary}</p>
            <ItemTags item={item} />
          </div>
          <div className={styles.feedMeta}>
            <strong>há {formatAge(item.ageSeconds)}</strong>
            <time dateTime={item.occurredAt}>
              {formatDateTime(item.occurredAt)}
            </time>
            {showScore && <span>score {item.score}</span>}
          </div>
        </li>
      ))}
    </ul>
  );
}
