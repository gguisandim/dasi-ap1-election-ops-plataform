import { Breadcrumb, Card, EmptyState, ErrorState, Loading, useAsync } from "@eops/ui";
import { formatDateTime } from "@eops/shared/format";
import { Link, useParams } from "react-router-dom";
import { SeverityBadge } from "../components";
import { auditService } from "../services/auditService";
import styles from "../styles/audit.module.css";

function DataView({ value }: { value: unknown }) {
  if (value === null || value === undefined) return <EmptyState title="Sem dados" description="Este evento não possui informação para esta seção." />;
  if (typeof value !== "object") return <span className={styles.scalar}>{String(value)}</span>;
  const entries = Object.entries(value as Record<string, unknown>);
  if (!entries.length) return <EmptyState title="Sem dados" description="O objeto registrado está vazio." />;
  return <dl className={styles.dataView}>{entries.map(([key, item]) => <div key={key}><dt>{key}</dt><dd>{item !== null && typeof item === "object" ? <DataView value={item} /> : String(item ?? "—")}</dd></div>)}</dl>;
}

function renderValue(value: unknown) {
  if (value === null || value === undefined) return "—";
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

export function AuditDetailPage() {
  const { id = "" } = useParams();
  const event = useAsync(() => auditService.get(id), [id]);
  const diff = useAsync(() => auditService.diff(id), [id]);
  if (event.loading) return <Loading label="Carregando evento…" />;
  if (event.error || !event.data) return <ErrorState error={event.error ?? new Error("Evento não encontrado.")} onRetry={event.reload} />;
  const data = event.data;
  return <section className={styles.page}>
    <Breadcrumb items={[{ label: "Auditoria", to: "/audit" }, { label: data.eventName ?? data.action }]} />
    <header><span>EVENTO AUDITÁVEL</span><h1>{data.eventName ?? data.action}</h1><p>{data.entityType} · {data.entityId ?? "sem ID"}</p></header>
    <div className={styles.detailMeta}>
      <Card><h2>Identificação</h2><dl>
        <dt>Ator</dt><dd>{data.actor ? `${data.actor.name} · ${data.actor.email}` : "Sistema"}</dd>
        <dt>Data/hora</dt><dd>{formatDateTime(data.createdAt)}</dd>
        <dt>Ação</dt><dd><span className={styles.actionBadge}>{data.action}</span></dd>
        <dt>Evento</dt><dd><code>{data.eventName ?? "—"}</code></dd>
        <dt>Entidade</dt><dd>{data.entityId ? <Link to={`/audit/entities/${encodeURIComponent(data.entityType)}/${encodeURIComponent(data.entityId)}`}>{data.entityType}</Link> : data.entityType}</dd>
        <dt>Entity ID</dt><dd>{data.entityId ?? "—"}</dd>
        <dt>Categoria</dt><dd>{data.category ?? "—"}</dd>
        <dt>Severidade</dt><dd><SeverityBadge severity={data.severity} /></dd>
        <dt>Pleito</dt><dd>{data.electionId ?? "—"}</dd>
        <dt>Zona</dt><dd>{data.electoralZoneId ?? "—"}</dd>
        <dt>Correlação</dt><dd>{data.correlationId ? <Link to={`/audit/correlation/${data.correlationId}`}><code>{data.correlationId}</code></Link> : "—"}</dd>
      </dl></Card>
      <Card><h2>Metadata</h2><DataView value={data.metadata} /></Card>
    </div>
    <Card><h2>Alterações normalizadas</h2>
      {diff.loading && <Loading label="Calculando diff…" />}
      {diff.error && <ErrorState error={diff.error} onRetry={diff.reload} />}
      {diff.data && <>
        {diff.data.changed.length === 0
          ? <EmptyState title="Sem alterações" description="Nenhum campo diverge entre o estado anterior e o posterior." />
          : <div className={styles.table}><table><thead><tr><th>Campo</th><th>Antes</th><th>Depois</th></tr></thead><tbody>
              {diff.data.changed.map((entry) => <tr key={entry.field}><td><strong>{entry.field}</strong></td><td>{renderValue(entry.before)}</td><td>{renderValue(entry.after)}</td></tr>)}
            </tbody></table></div>}
        <p className={styles.diffSummary}>{diff.data.unchanged} campo(s) inalterado(s){diff.data.truncated ? " · resultado truncado em 200 alterações" : ""}.</p>
      </>}
    </Card>
    <div className={styles.diffGrid}><Card><h2>Antes</h2><DataView value={data.oldData} /></Card><Card><h2>Depois</h2><DataView value={data.newData} /></Card></div>
  </section>;
}
