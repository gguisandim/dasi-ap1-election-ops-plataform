import { useState } from "react";
import { Button, Card, ErrorState, Field, Input, Loading, Select, useAsync } from "@eops/ui";
import { ReportNav } from "../components/ReportNav";
import { REPORT_METRICS, metricLabel } from "../metrics";
import { reportsService } from "../../services/reportsService";
import type { ExportJsonResult, ReportFilters } from "../../types";
import styles from "../../styles/overview.module.css";

export function ReportsExportPage() {
  const references = useAsync(reportsService.references, []);
  const [filters, setFilters] = useState<ReportFilters>({});
  const [metrics, setMetrics] = useState<string[]>([]);
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<Error>();
  const [preview, setPreview] = useState<ExportJsonResult>();

  const change = (key: keyof ReportFilters, value: string) => setFilters((current) => ({ ...current, [key]: value || undefined }));
  const zones = references.data?.zones.filter((zone) => !filters.electionId || zone.electionId === filters.electionId) ?? [];
  const places = references.data?.places.filter((place) => !filters.zoneId || place.electoralZoneId === filters.zoneId) ?? [];

  const run = async (kind: "csv" | "pdf" | "json") => {
    setBusy(kind);
    setError(undefined);
    try {
      if (kind === "csv") await reportsService.exportCsv(filters);
      else if (kind === "pdf") await reportsService.exportPdf(filters);
      else {
        const data = await reportsService.exportJson({ ...filters, metrics: metrics.length ? metrics.join(",") : undefined });
        reportsService.downloadJson(data);
        setPreview(data);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause : new Error("Não foi possível exportar."));
    } finally {
      setBusy(undefined);
    }
  };

  return <section className={styles.page}>
    <header className={styles.header}><div><span className={styles.tag}>ANALYTICS</span><h1>Exportação</h1><p>Exporte os relatórios em CSV, PDF ou JSON estruturado (seções por domínio mais séries temporais selecionadas).</p></div></header>
    <ReportNav />
    <Card>
      <h2>Filtros</h2>
      <div className={styles.filters}>
        <Input aria-label="Data inicial" type="date" value={filters.from ?? ""} onChange={(event) => change("from", event.target.value)} />
        <Input aria-label="Data final" type="date" value={filters.to ?? ""} onChange={(event) => change("to", event.target.value)} />
        <Select aria-label="Pleito" value={filters.electionId ?? ""} onChange={(event) => change("electionId", event.target.value)}><option value="">Todos os pleitos</option>{references.data?.elections.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>
        <Select aria-label="Zona" value={filters.zoneId ?? ""} onChange={(event) => change("zoneId", event.target.value)}><option value="">Todas as zonas</option>{zones.map((item) => <option key={item.id} value={item.id}>Zona {item.number} · {item.name}</option>)}</Select>
        <Select aria-label="Local" value={filters.pollingPlaceId ?? ""} onChange={(event) => change("pollingPlaceId", event.target.value)}><option value="">Todos os locais</option>{places.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>
      </div>
      <Field label="Métricas para séries temporais no JSON (opcional; exige período)">
        <select className={styles.multiSelect} multiple size={6} value={metrics} onChange={(event) => setMetrics(Array.from(event.target.selectedOptions).map((option) => option.value))}>
          {REPORT_METRICS.map((metric) => <option key={metric} value={metric}>{metricLabel(metric)}</option>)}
        </select>
      </Field>
      {error && <ErrorState error={error} />}
      <div className={styles.actions}>
        <Button disabled={busy !== undefined} onClick={() => void run("csv")}>{busy === "csv" ? "Exportando…" : "Exportar CSV"}</Button>
        <Button disabled={busy !== undefined} onClick={() => void run("pdf")}>{busy === "pdf" ? "Exportando…" : "Exportar PDF"}</Button>
        <Button disabled={busy !== undefined} onClick={() => void run("json")}>{busy === "json" ? "Exportando…" : "Exportar JSON"}</Button>
      </div>
    </Card>
    <Card>
      <h2>Pré-visualização</h2>
      {busy === "json" && <Loading label="Gerando JSON estruturado…" />}
      {preview ? <>
        <p className={styles.period}>Gerado em {new Date(preview.generatedAt).toLocaleString("pt-BR")} · seções: {Object.keys(preview.sections).join(", ")}{Object.keys(preview.timeseries).length ? ` · séries: ${Object.keys(preview.timeseries).map(metricLabel).join(", ")}` : ""}</p>
        <pre className={styles.codeBlock}>{JSON.stringify(preview, null, 2)}</pre>
      </> : <p className={styles.muted}>Gere o export JSON para visualizar a estrutura aqui.</p>}
    </Card>
  </section>;
}
