import { AssetCondition, AssetStatus, IncidentSeverity, MonitoringStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { deriveOperationalStatus } from "./operational-status";
describe("deriveOperationalStatus", () => {
  it("prioriza incidente crítico ativo", () => expect(deriveOperationalStatus(MonitoringStatus.NORMAL, [{ severity: IncidentSeverity.CRITICAL }], [])).toBe(MonitoringStatus.CRITICAL));
  it("sinaliza atenção para ativo crítico indisponível", () => expect(deriveOperationalStatus(MonitoringStatus.NORMAL, [], [{ status: AssetStatus.MAINTENANCE, condition: AssetCondition.UNAVAILABLE }])).toBe(MonitoringStatus.ATTENTION));
  it("mantém normal sem ocorrências relevantes", () => expect(deriveOperationalStatus(MonitoringStatus.NORMAL, [{ severity: IncidentSeverity.MEDIUM }], [{ status: AssetStatus.IN_USE, condition: AssetCondition.GOOD }])).toBe(MonitoringStatus.NORMAL));
});
