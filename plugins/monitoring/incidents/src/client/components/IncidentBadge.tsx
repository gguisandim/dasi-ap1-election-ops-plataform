import { Badge } from "@eops/ui";
import { INCIDENT_SEVERITY_LABELS, INCIDENT_STATUS_LABELS, type IncidentSeverity, type IncidentStatus } from "@eops/shared";

export function SeverityBadge({ severity }: { severity: IncidentSeverity }) {
  const tone = severity === "CRITICAL" ? "danger" : severity === "HIGH" ? "warning" : "neutral";
  return <Badge tone={tone}>{INCIDENT_SEVERITY_LABELS[severity]}</Badge>;
}

export function IncidentStatusBadge({ status }: { status: IncidentStatus }) {
  const tone = status === "RESOLVED" || status === "CLOSED" ? "success" : status === "CANCELLED" ? "neutral" : status === "IN_PROGRESS" ? "warning" : "danger";
  return <Badge tone={tone}>{INCIDENT_STATUS_LABELS[status]}</Badge>;
}
