import { Badge } from "@eops/ui";
import {
  RESOURCE_REQUEST_PRIORITY_LABELS,
  RESOURCE_REQUEST_STATUS_LABELS,
  RESOURCE_REQUEST_URGENCY_LABELS,
  type ResourceRequestPriority,
  type ResourceRequestStatus,
  type ResourceRequestUrgency,
} from "@eops/shared/resource-requests";
import styles from "../styles/resource-requests.module.css";

const priorityTone: Record<
  ResourceRequestPriority,
  "neutral" | "success" | "warning" | "danger"
> = {
  LOW: "neutral",
  NORMAL: "neutral",
  HIGH: "warning",
  CRITICAL: "danger",
};

const statusTone: Record<
  ResourceRequestStatus,
  "neutral" | "success" | "warning" | "danger"
> = {
  DRAFT: "neutral",
  SUBMITTED: "warning",
  TRIAGED: "warning",
  APPROVED: "success",
  PARTIALLY_FULFILLED: "warning",
  FULFILLED: "success",
  REJECTED: "danger",
  CANCELLED: "neutral",
};

export function PriorityBadge({ priority }: { priority: ResourceRequestPriority }) {
  return (
    <Badge tone={priorityTone[priority]}>
      {RESOURCE_REQUEST_PRIORITY_LABELS[priority]}
    </Badge>
  );
}

export function StatusBadge({ status }: { status: ResourceRequestStatus }) {
  return (
    <Badge tone={statusTone[status]}>
      {RESOURCE_REQUEST_STATUS_LABELS[status]}
    </Badge>
  );
}

const urgencyClass: Record<ResourceRequestUrgency, string> = {
  ON_TRACK: styles.urgencyOnTrack,
  DUE_SOON: styles.urgencyDueSoon,
  OVERDUE: styles.urgencyOverdue,
  COMPLETED: styles.urgencyCompleted,
};

export function UrgencyBadge({ urgency }: { urgency: ResourceRequestUrgency }) {
  return (
    <span className={`${styles.urgency} ${urgencyClass[urgency]}`}>
      {RESOURCE_REQUEST_URGENCY_LABELS[urgency]}
    </span>
  );
}

export function ProgressBar({
  percent,
  label,
}: {
  percent: number;
  label: string;
}) {
  return (
    <div
      className={styles.progress}
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <span style={{ width: `${percent}%` }} />
    </div>
  );
}
