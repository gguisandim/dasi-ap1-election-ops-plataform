import { Breadcrumb, Card, EmptyState, ErrorState, Loading, useAsync } from "@eops/ui";
import { formatDateTime } from "@eops/shared/format";
import { useParams } from "react-router-dom";
import { auditService } from "../services/auditService";
import styles from "../styles/audit.module.css";

function DataView({ value }: { value: unknown }) {
  if (value === null || value === undefined) return <EmptyState title="Sem dados" description="Este evento não possui informação para esta seção." />;
  if (typeof value !== "object") return <span className={styles.scalar}>{String(value)}</span>;
  const entries = Object.entries(value as Record<string, unknown>);
  if (!entries.length) return <EmptyState title="Sem dados" description="O objeto registrado está vazio." />;
  return <dl className={styles.dataView}>{entries.map(([key, item]) => <div key={key}><dt>{key}</dt><dd>{item !== null && typeof item === "object" ? <DataView value={item} /> : String(item ?? "—")}</dd></div>)}</dl>;
}

export function AuditDetailPage() {
  const { id = "" } = useParams();
  const { data, loading, error, reload } = useAsync(() => auditService.get(id), [id]);
  if (loading) return <Loading label="Carregando evento…" />;
  if (error || !data) return <ErrorState error={error ?? new Error("Evento não encontrado.")} onRetry={reload} />;
  return <section className={styles.page}><Breadcrumb items={[{ label: "Auditoria", to: "/audit" }, { label: data.eventName ?? data.action }]} /><header><span>EVENTO AUDITÁVEL</span><h1>{data.eventName ?? data.action}</h1><p>{data.entityType} · {data.entityId ?? "sem ID"}</p></header>
    <div className={styles.detailMeta}><Card><h2>Identificação</h2><dl><dt>Ator</dt><dd>{data.actor ? `${data.actor.name} · ${data.actor.email}` : "Sistema"}</dd><dt>Data/hora</dt><dd>{formatDateTime(data.createdAt)}</dd><dt>Ação</dt><dd><span className={styles.actionBadge}>{data.action}</span></dd><dt>Evento</dt><dd><code>{data.eventName ?? "—"}</code></dd><dt>Entidade</dt><dd>{data.entityType}</dd><dt>Entity ID</dt><dd>{data.entityId ?? "—"}</dd></dl></Card><Card><h2>Metadata</h2><DataView value={data.metadata} /></Card></div>
    <div className={styles.diffGrid}><Card><h2>Antes</h2><DataView value={data.oldData} /></Card><Card><h2>Depois</h2><DataView value={data.newData} /></Card></div>
  </section>;
}
