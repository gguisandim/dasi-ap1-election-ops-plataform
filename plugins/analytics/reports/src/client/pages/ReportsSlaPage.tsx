import { useState } from "react";
import { Card, ErrorState, Input, Loading, Select, useAsync } from "@eops/ui";
import { ReportNav } from "../components/ReportNav";
import { reportsService } from "../../services/reportsService";
import type { IndicatorResult, ReportFilters, SlaReport } from "../../types";
import styles from "../../styles/overview.module.css";

interface IndicatorDescriptor {
  key: keyof SlaReport["indicators"];
  label: string;
  hint: string;
  unit: string;
}

const INDICATORS: IndicatorDescriptor[] = [
  { key: "meanResponseMinutes", label: "Tempo médio de resposta", hint: "acknowledgedAt − openedAt", unit: "min" },
  { key: "meanResolutionMinutes", label: "Tempo médio de resolução", hint: "resolvedAt − openedAt", unit: "min" },
  { key: "mttrMinutes", label: "MTTR (HIGH/CRITICAL)", hint: "resolução restrita a severidade alta", unit: "min" },
  { key: "slaCompliancePercent", label: "Compliance de SLA", hint: "resolvidos no prazo / com slaDeadline", unit: "%" },
  { key: "deadlineMisses", label: "Prazos vencidos", hint: "não terminais vencidos + terminais após o prazo", unit: "" },
  { key: "escalationRatePercent", label: "Taxa de escalonamento", hint: "incidentes com escalationLevel > 0", unit: "%" },
  { key: "transmissionDowntimeMinutes", label: "Downtime de transmissão", hint: "soma dos intervalos OFFLINE", unit: "min" },
  { key: "transmissionUptimePercent", label: "Uptime de transmissão", hint: "(janela − downtime) / janela", unit: "%" },
  { key: "fulfillmentMeanMinutes", label: "Tempo médio de atendimento", hint: "fulfilledAt − submittedAt", unit: "min" },
  { key: "dispatchMeanMinutes", label: "Tempo médio de despacho", hint: "completedAt − requestedAt", unit: "min" },
];

function formatIndicator(indicator: IndicatorResult | undefined, unit: string) {
  if (!indicator || indicator.value === null) return "sem dados";
  return unit ? `${indicator.value} ${unit}` : String(indicator.value);
}

export function ReportsSlaPage() {
  const [filters, setFilters] = useState<ReportFilters>({});
  const report = useAsync(() => reportsService.sla(filters), [JSON.stringify(filters)]);
  const references = useAsync(reportsService.references, []);
  const change = (key: keyof ReportFilters, value: string) => setFilters((current) => ({ ...current, [key]: value || undefined }));
  const zones = references.data?.zones.filter((zone) => !filters.electionId || zone.electionId === filters.electionId) ?? [];
  const places = references.data?.places.filter((place) => !filters.zoneId || place.electoralZoneId === filters.zoneId) ?? [];
  return <section className={styles.page}>
    <header className={styles.header}><div><span className={styles.tag}>ANALYTICS</span><h1>SLA e tempos</h1><p>Indicadores operacionais com denominador explícito. Quando não há amostra, o valor é exibido como “sem dados”, nunca como zero.</p></div></header>
    <ReportNav />
    <div className={styles.filters}>
      <Input aria-label="Data inicial" type="date" value={filters.from ?? ""} onChange={(event) => change("from", event.target.value)} />
      <Input aria-label="Data final" type="date" value={filters.to ?? ""} onChange={(event) => change("to", event.target.value)} />
      <Select aria-label="Pleito" value={filters.electionId ?? ""} onChange={(event) => change("electionId", event.target.value)}><option value="">Todos os pleitos</option>{references.data?.elections.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>
      <Select aria-label="Zona" value={filters.zoneId ?? ""} onChange={(event) => change("zoneId", event.target.value)}><option value="">Todas as zonas</option>{zones.map((item) => <option key={item.id} value={item.id}>Zona {item.number} · {item.name}</option>)}</Select>
      <Select aria-label="Local" value={filters.pollingPlaceId ?? ""} onChange={(event) => change("pollingPlaceId", event.target.value)}><option value="">Todos os locais</option>{places.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>
    </div>
    {report.loading && <Loading label="Calculando indicadores de SLA…" />}
    {report.error && <ErrorState error={report.error} onRetry={report.reload} />}
    {report.data && <>
      <p className={styles.period}>Janela: {new Date(report.data.scope.from ?? report.data.generatedAt).toLocaleString("pt-BR")} até {new Date(report.data.scope.to ?? report.data.generatedAt).toLocaleString("pt-BR")} · {Math.round(report.data.windowMinutes)} min</p>
      <div className={styles.indicatorGrid}>
        {INDICATORS.map((descriptor) => {
          const indicator = report.data?.indicators[descriptor.key];
          const empty = !indicator || indicator.value === null;
          return <Card key={descriptor.key}>
            <span>{descriptor.label}</span>
            <strong className={empty ? styles.zeroValue : undefined}>{formatIndicator(indicator, descriptor.unit)}</strong>
            <p className={styles.muted}>{descriptor.hint} · amostra {indicator?.sampleSize ?? 0}</p>
          </Card>;
        })}
      </div>
    </>}
  </section>;
}
