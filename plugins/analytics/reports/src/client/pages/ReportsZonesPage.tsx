import { useState } from "react";
import { Card, EmptyState, ErrorState, Input, Loading, Select, useAsync } from "@eops/ui";
import { ReportNav } from "../components/ReportNav";
import { REPORT_METRICS, metricLabel } from "../metrics";
import { reportsService } from "../../services/reportsService";
import type { ZoneMetricCell, ZoneRanking } from "../../types";
import styles from "../../styles/overview.module.css";

function formatNormalized(value: number | null, suffix: string) {
  return value === null ? "sem denominador" : `${value} ${suffix}`;
}

export function ReportsZonesPage() {
  const references = useAsync(reportsService.references, []);
  const [electionId, setElectionId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [metric, setMetric] = useState<string>(REPORT_METRICS[0]);

  const report = useAsync(
    () => electionId
      ? reportsService.zones({ electionId, from: from || undefined, to: to || undefined, metrics: metric })
      : Promise.resolve(null),
    [electionId, from, to, metric],
  );

  return <section className={styles.page}>
    <header className={styles.header}><div><span className={styles.tag}>ANALYTICS</span><h1>Comparação de zonas</h1><p>Cada métrica é exposta por zona com o denominador (eleitores e locais) e ranking absoluto e normalizado. Sem denominador, o valor normalizado é “sem denominador”.</p></div></header>
    <ReportNav />
    <div className={styles.filters}>
      <Select aria-label="Pleito" value={electionId} onChange={(event) => setElectionId(event.target.value)}><option value="">Selecione um pleito</option>{references.data?.elections.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>
      <Select aria-label="Métrica" value={metric} onChange={(event) => setMetric(event.target.value)}>{REPORT_METRICS.map((item) => <option key={item} value={item}>{metricLabel(item)}</option>)}</Select>
      <Input aria-label="Data inicial" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
      <Input aria-label="Data final" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
    </div>
    {!electionId && <Card><p className={styles.muted}>Selecione um pleito para comparar zonas.</p></Card>}
    {electionId && report.loading && <Loading label="Comparando zonas…" />}
    {electionId && report.error && <ErrorState error={report.error} onRetry={report.reload} />}
    {electionId && report.data && (report.data.zones.length === 0
      ? <EmptyState title="Sem zonas" description="O pleito selecionado não possui zonas cadastradas." />
      : <Card>
        <h2>{metricLabel(metric)} por zona</h2>
        <div className={styles.tableWrap}><table><thead><tr>
          <th>Zona</th><th>Valor</th><th>Amostra</th><th>Eleitores</th><th>Locais</th><th>Por 1000 eleitores</th><th>Por local</th><th>Rank absoluto</th><th>Rank normalizado</th>
        </tr></thead><tbody>
          {report.data.zones.map((zone) => {
            const cell: ZoneMetricCell | undefined = zone.metrics[metric];
            const rank: ZoneRanking | undefined = zone.rankings[metric];
            return <tr key={zone.zoneId}>
              <td>Zona {zone.zoneNumber} · {zone.zoneName}</td>
              <td>{cell?.value ?? 0}</td>
              <td>{cell?.sampleSize ?? 0}</td>
              <td>{zone.registeredVoters}</td>
              <td>{zone.pollingPlaceCount}</td>
              <td>{formatNormalized(cell?.per1000Voters ?? null, "/mil")}</td>
              <td>{formatNormalized(cell?.perPlace ?? null, "/local")}</td>
              <td>{rank?.byAbsolute ?? "—"}</td>
              <td>{rank?.byNormalized ?? "—"}</td>
            </tr>;
          })}
        </tbody></table></div>
        <p className={styles.period}>Escopo: {new Date(report.data.scope.from ?? report.data.generatedAt).toLocaleString("pt-BR")} até {new Date(report.data.scope.to ?? report.data.generatedAt).toLocaleString("pt-BR")}</p>
      </Card>)}
  </section>;
}
