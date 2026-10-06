import { Badge } from "@eops/ui";
import {
  POSTMORTEM_STATUS_LABELS,
  type PostmortemStatus,
} from "@eops/shared/postmortems";
import styles from "../styles/postmortems.module.css";

const statusClass: Record<PostmortemStatus, string> = {
  DRAFT: styles.pillDraft,
  IN_REVIEW: styles.pillInReview,
  CHANGES_REQUESTED: styles.pillChanges,
  APPROVED: styles.pillApproved,
  PUBLISHED: styles.pillPublished,
  ARCHIVED: styles.pillArchived,
};

export function PostmortemStatusPill({ status }: { status: PostmortemStatus }) {
  return (
    <span className={`${styles.pill} ${statusClass[status]}`}>
      {POSTMORTEM_STATUS_LABELS[status]}
    </span>
  );
}

export function SeverityBadge({ severity }: { severity: string }) {
  const tone =
    severity === "CRITICAL"
      ? "danger"
      : severity === "HIGH"
        ? "warning"
        : "neutral";
  return <Badge tone={tone}>{severity}</Badge>;
}

export function PriorityBadge({ priority }: { priority: string }) {
  const tone =
    priority === "CRITICAL"
      ? "danger"
      : priority === "HIGH"
        ? "warning"
        : "neutral";
  return <Badge tone={tone}>{priority}</Badge>;
}
