import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button, Card, EmptyState, ErrorState, Input, LinkButton, Loading, Select, useAsync } from "@eops/ui";
import { BarChart } from "./BarChart";
import { ReportNav } from "./ReportNav";
import { reportsService } from "../../services/reportsService";
import type { DomainReport, ReportBreakdown, ReportFilters, ReportRow, SeriesItem } from "../../types";
import styles from "../../styles/overview.module.css";

export interface DomainColumn { label: string; value: (row: ReportRow) => ReactNode; }
export interface DomainReportConfig {
  title: string;
  description: string;
  load: (filters: ReportFilters) => Promise<DomainReport>;
  cards: Array<{ label: string; value: (summary: Record<string, number | string>) => string | number }>;
  columns: DomainColumn[];
  placeColumns?: DomainColumn[];
  charts?: Array<{ title: string; data: (breakdown: ReportBreakdown) => SeriesItem[] }>;
  compareLabels?: Record<string, string>;
  link?: { label: string; to: string };
  drilldown?: string;
}

function series(breakdown: ReportBreakdown, key: string) {
  const value = breakdown[key];
  return Array.isArray(value) ? value as SeriesItem[] : [];
}

export const num = (row: ReportRow, key: string) => Number(row[key] ?? 0);

export function chart(title: string, key: string) { return { title, data: (breakdown: ReportBreakdown) => series(breakdown, key) }; }

export function DomainReportPage({ config }: { config: DomainReportConfig }) {
  const [filters, setFilters] = useState<ReportFilters>({});
  const report = useAsync(() => config.load(filters), [JSON.stringify(filters)]);
  const references = useAsync(reportsService.references, []);
  const change = (key: keyof ReportFilters, value: string) => setFilters((current) => ({ ...current, [key]: value || undefined }));
  const zones = references.data?.zones.filter((zone) => !filters.electionId || zone.electionId === filters.electionId) ?? [];
  const places = references.data?.places.filter((place) => !filters.zoneId || place.electoralZoneId === filters.zoneId) ?? [];
  const data = report.data;
  const empty = data && data.breakdown.byZone.length === 0 && data.breakdown.byPlace.length === 0;
  const comparison = data?.comparison;
  const placeColumns = config.placeColumns ?? config.columns;
  return <section className={styles.page}>
    <header className={styles.header}><div><span className={styles.tag}>ANALYTICS</span><h1>{config.title}</h1><p>{config.description}</p></div><div className={styles.actions}>{config.link && <LinkButton to={config.link.to}>{config.link.label}</LinkButton>}<LinkButton secondary to={config.drilldown ?? "/reports/timeseries"}>Séries e drill-down</LinkButton></div></header>
    <ReportNav />
    <div className={styles.filters}>
      <Input aria-label="Data inicial" type="date" value={filters.from ?? ""} onChange={(event) => change("from", event.target.value)} />
      <Input aria-label="Data final" type="date" value={filters.to ?? ""} onChange={(event) => change("to", event.target.value)} />
      <Select aria-label="Pleito" value={filters.electionId ?? ""} onChange={(event) => change("electionId", event.target.value)}><option value="">Todos os pleitos</option>{references.data?.elections.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>
      <Select aria-label="Zona" value={filters.zoneId ?? ""} onChange={(event) => change("zoneId", event.target.value)}><option value="">Todas as zonas</option>{zones.map((item) => <option key={item.id} value={item.id}>Zona {item.number} · {item.name}</option>)}</Select>
      <Select aria-label="Local" value={filters.pollingPlaceId ?? ""} onChange={(event) => change("pollingPlaceId", event.target.value)}><option value="">Todos os locais</option>{places.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>
      <Button onClick={() => setFilters({})}>Limpar filtros</Button>
    </div>
    {report.loading && <Loading label="Consolidando indicadores…" />}
    {report.error && <ErrorState error={report.error} onRetry={report.reload} />}
    {data && empty && <EmptyState title="Sem dados no período" description="Nenhum registro persistido corresponde aos filtros selecionados." />}
    {data && !empty && <>
      <p className={styles.period}>Período: {data.period.from ?? "início"} até {data.period.to ?? "agora"} · Gerado em {new Date(data.generatedAt).toLocaleString("pt-BR")}</p>
      <div className={styles.metrics}>{config.cards.map((card) => <Card key={card.label}><span>{card.label}</span><strong>{card.value(data.summary)}</strong></Card>)}</div>
      {config.charts && config.charts.length > 0 && <div className={styles.grid}><Card><h2>Distribuições</h2><div className={styles.chartGrid}>{config.charts.map((chart) => <BarChart key={chart.title} title={chart.title} data={chart.data(data.breakdown)} />)}</div></Card></div>}
      <Card><h2>Por zona</h2><div className={styles.tableWrap}><table><thead><tr><th>Zona</th>{config.columns.map((column) => <th key={column.label}>{column.label}</th>)}</tr></thead><tbody>{data.breakdown.byZone.map((row) => <tr key={row.id}><td>{row.label}</td>{config.columns.map((column) => <td key={column.label}>{column.value(row)}</td>)}</tr>)}</tbody></table></div></Card>
      <Card><h2>Por local</h2><div className={styles.tableWrap}><table><thead><tr><th>Local</th>{placeColumns.map((column) => <th key={column.label}>{column.label}</th>)}</tr></thead><tbody>{data.breakdown.byPlace.map((row) => <tr key={row.id}><td><Link className={styles.link} to={`/polling-places/${row.id}`}>{row.label}</Link></td>{placeColumns.map((column) => <td key={column.label}>{column.value(row)}</td>)}</tr>)}</tbody></table></div></Card>
      <Card><h2>Comparação de período</h2>{comparison?.available && comparison.previous ? <div className={styles.inlineMetrics}>{Object.entries(comparison.current).map(([key, value]) => <span key={key}>{config.compareLabels?.[key] ?? key}: <strong>{value}</strong> (anterior: {comparison.previous?.[key] ?? 0})</span>)}</div> : <p>Defina data inicial e final para comparar com o período anterior de mesma duração.</p>}</Card>
    </>}
  </section>;
}
