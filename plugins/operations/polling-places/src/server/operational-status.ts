import { AssetCondition, AssetStatus, IncidentSeverity, MonitoringStatus } from "@prisma/client";
export function deriveOperationalStatus(base: MonitoringStatus, incidents: Array<{ severity: IncidentSeverity }> = [], assets: Array<{ status: AssetStatus; condition: AssetCondition }> = []) {
  if (incidents.some((incident) => incident.severity === IncidentSeverity.CRITICAL)) return MonitoringStatus.CRITICAL;
  if (base === MonitoringStatus.OFFLINE) return MonitoringStatus.OFFLINE;
  const incidentAttention = incidents.some((incident) => incident.severity === IncidentSeverity.HIGH);
  const assetAttention = assets.some((asset) => asset.status === AssetStatus.MAINTENANCE || asset.status === AssetStatus.LOST || asset.condition === AssetCondition.DAMAGED || asset.condition === AssetCondition.UNAVAILABLE);
  return incidentAttention || assetAttention ? MonitoringStatus.ATTENTION : base;
}
