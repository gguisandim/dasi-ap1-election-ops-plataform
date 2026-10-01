import { ASSET_CONDITION_LABELS, ASSET_STATUS_LABELS, type AssetCondition, type AssetStatus } from "@eops/shared/inventory";
import { Badge } from "@eops/ui";

export function AssetStatusBadge({ status }: { status: AssetStatus }) {
  return <Badge tone={status === "AVAILABLE" || status === "IN_USE" ? "success" : status === "MAINTENANCE" || status === "IN_TRANSIT" ? "warning" : status === "LOST" || status === "RETIRED" ? "danger" : "neutral"}>{ASSET_STATUS_LABELS[status]}</Badge>;
}
export function AssetConditionBadge({ condition }: { condition: AssetCondition }) {
  return <Badge tone={condition === "GOOD" ? "success" : condition === "ATTENTION" ? "warning" : "danger"}>{ASSET_CONDITION_LABELS[condition]}</Badge>;
}
