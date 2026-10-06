import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, EmptyState, ErrorState, Input, Loading, Select, useAsync } from "@eops/ui";
import { REPORT_GRANULARITIES, type ReportGranularity } from "@eops/shared/reports";
import { BarChart } from "../components/BarChart";
import { ReportNav } from "../components/ReportNav";
import { REPORT_METRICS, metricLabel } from "../metrics";
import { reportsService } from "../../services/reportsService";
import type { DrilldownResult, ReportBucket, SeriesItem } from "../../types";
import styles from "../../styles/overview.module.css";

const GRANULARITY_LABELS: Record<ReportGranularity, string> = { hour: "Hora", day: "Dia", week: "Semana" };

function toLocalInput(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function isoFromLocal(value: string, fallback: string) {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
}

function defaultRange() {
  const to = new Date();
  const from = new Date(to.getTime() - 7 * 86_400_000);
  return { from: toLocalInput(from), to: toLocalInput(to) };
}

export function ReportsTimeseriesPage() {
  const [{ from, to }, setRange] = useState(defaultRange);
  const [metric, setMetric] = useState<string>(REPORT_METRICS[0]);
  const [granularity, setGranularity] = useState<ReportGranularity>("day");
  const [includeSimulated, setIncludeSimulated] = useState(false);
  const [selected, setSelected] = useState<ReportBucket>();

  const series = useAsync(
    () => reportsService.timeseries({ metric, granularity, includeSimulated, from: isoFromLocal(from, ""), to: isoFromLocal(to, "") }),
    [metric, granularity, includeSimulated, from, to],
  );
  const drilldown = useAsync<DrilldownResult | null>(
    () => selected
      ? reportsService.drilldown({ metric, from: isoFromLocal(from, ""), to: isoFromLocal(to, ""), bucketStart: selected.bucketStart, bucketEnd: selected.bucketEnd })
      : Promise.resolve(null),
    [metric, from, to, selected?.bucketStart, selected?.bucketEnd],
  );

  const buckets: SeriesItem[] = series.data?.buckets.map((bucket) => ({ name: bucket.bucketStart, value: bucket.value })) ?? [];
  const formatBucket = (name: string) => new Date(name).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit" });

  return <section className={styles.page}>
    <header className={styles.header}>
      <div><span className={styles.tag}>ANALYTICS</span><h1>Séries temporais</h1><p>Eixo temporal contínuo do vocabulário fechado de métricas. Clique em um bucket para ver as entidades que o compõem.</p></div>
    </header>
    <ReportNav />
    <div className={styles.filters}>
      <Select aria-label="Métrica" value={metric} onChange={(event) => { setMetric(event.target.value); setSelected(undefined); }}>{REPORT_METRICS.map((item) => <option key={item} value={item}>{metricLabel(item)}</option>)}</Select>
      <Select aria-label="Granularidade" value={granularity} onChange={(event) => setGranularity(event.target.value as ReportGranularity)}>{REPORT_GRANULARITIES.map((item) => <option key={item} value={item}>{GRANULARITY_LABELS[item]}</option>)}</Select>
      <Input aria-label="De" type="datetime-local" value={from} onChange={(event) => setRange((current) => ({ ...current, from: event.target.value }))} />
      <Input aria-label="Até" type="datetime-local" value={to} onChange={(event) => setRange((current) => ({ ...current, to: event.target.value }))} />
    </div>
    <label className={styles.checkboxRow}><input type="checkbox" checked={includeSimulated} onChange={(event) => setIncludeSimulated(event.target.checked)} />Incluir artefatos simulados (default: fora)</label>
    {series.loading && <Loading label="Consolidando série temporal…" />}
    {series.error && <ErrorState error={series.error} onRetry={series.reload} />}
    {series.data && <>
      <div className={styles.metrics}>
        <Card><span>Buckets</span><strong>{series.data.bucketCount}</strong></Card>
        <Card><span>Total no período</span><strong>{series.data.totals.value}</strong></Card>
        <Card><span>Amostra</span><strong>{series.data.totals.sampleSize}</strong></Card>
      </div>
      <Card>
        <h2>{metricLabel(metric)}</h2>
        <BarChart title={`Granularidade: ${GRANULARITY_LABELS[granularity]}`} data={buckets} format={(value) => String(value)} activeName={selected?.bucketStart} onSelect={(name) => setSelected(series.data?.buckets.find((bucket) => bucket.bucketStart === name))} />
        <p className={styles.period}>Janela: {new Date(series.data.from).toLocaleString("pt-BR")} até {new Date(series.data.to).toLocaleString("pt-BR")}</p>
      </Card>
      {selected && <Card>
        <h2>Drill-down do bucket {formatBucket(selected.bucketStart)}</h2>
        {drilldown.loading && <Loading label="Carregando entidades…" />}
        {drilldown.error && <ErrorState error={drilldown.error} onRetry={drilldown.reload} />}
        {drilldown.data && (drilldown.data.items.length === 0
          ? <EmptyState title="Bucket vazio" description="Nenhuma entidade compõe este bucket." />
          : <><p className={styles.muted}>{drilldown.data.total} entidade(s) no bucket{drilldown.data.truncated ? `; exibindo as primeiras ${drilldown.data.items.length}` : ""}.</p>
            <div className={styles.tableWrap}><table><thead><tr><th>Entidade</th><th>Status</th><th>Quando</th><th>Ação</th></tr></thead><tbody>
              {drilldown.data.items.map((item) => <tr key={`${item.kind}-${item.id}`}>
                <td><strong>{item.title}</strong>{item.subtitle ? <span className={styles.muted}> · {item.subtitle}</span> : null}</td>
                <td>{item.status}{item.severity ? ` · ${item.severity}` : ""}</td>
                <td>{new Date(item.occurredAt).toLocaleString("pt-BR")}</td>
                <td><Link className={styles.link} to={item.deepLink}>Abrir</Link></td>
              </tr>)}
            </tbody></table></div></>)}
      </Card>}
    </>}
  </section>;
}
