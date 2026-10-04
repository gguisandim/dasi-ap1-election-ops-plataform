import { useState } from "react";
import { Breadcrumb, Card, EmptyState, ErrorState, Input, LinkButton, Loading, Pagination, useAsync } from "@eops/ui";
import { formatDateTime } from "@eops/shared/format";
import { Link } from "react-router-dom";
import { IncidentStatusBadge, SeverityBadge } from "../components/IncidentBadge";
import { incidentService } from "../services/incidentService";
import styles from "../styles/incidents.module.css";

const slaLabels = { OVERDUE: "SLA vencido", DUE_SOON: "SLA próximo", ON_TRACK: "No prazo", COMPLETED: "Concluído" } as const;

export function IncidentQueuePage() {
  const [query, setQuery] = useState({ page: 1, pageSize: 20, search: "" });
  const { data, error, loading, reload } = useAsync(() => incidentService.queue(query), [JSON.stringify(query)]);
  return <section className={styles.page}>
    <Breadcrumb items={[{ label: "Incidentes", to: "/incidents" }, { label: "Fila operacional" }]} />
    <header className={styles.header}><div><span className={styles.eyebrow}>PRIORIZAÇÃO</span><h1>Fila operacional</h1><p>Incidentes ordenados por urgência, SLA e necessidade de intervenção.</p></div><LinkButton to="/incidents/new">Novo incidente</LinkButton></header>
    <Card><div className={styles.queueToolbar}><Input aria-label="Buscar na fila" placeholder="Buscar por código, título ou local" value={query.search} onChange={(event) => setQuery((current) => ({ ...current, search: event.target.value, page: 1 }))} /><span>A ordem considera escalonamento, severidade, SLA, reconhecimento e atribuição.</span></div></Card>
    {loading && <Loading label="Priorizando fila…" />}
    {error && <ErrorState error={error} onRetry={reload} />}
    {data?.items.length === 0 && <EmptyState title="Fila sem incidentes pendentes" description="Não há incidentes operacionais que exijam atenção agora." />}
    {data && data.items.length > 0 && <>
      <ol className={styles.queueList}>{data.items.map((incident, index) => <li key={incident.id}>
        <span className={styles.queueRank} aria-label={`Prioridade ${((data.page - 1) * data.pageSize) + index + 1}`}>{((data.page - 1) * data.pageSize) + index + 1}</span>
        <div className={styles.queueMain}><div className={styles.badges}><SeverityBadge severity={incident.severity} /><IncidentStatusBadge status={incident.status} /><span className={`${styles.slaBadge} ${styles[incident.slaState.toLowerCase()]}`}>{slaLabels[incident.slaState]}</span>{incident.escalationLevel > 0 && <span className={styles.escalated}>Escalado N{incident.escalationLevel}</span>}</div><Link to={`/incidents/${incident.id}`}>{incident.code} · {incident.title}</Link><p>{incident.category.name} · {incident.pollingPlace?.name ?? incident.electoralZone?.name ?? "Local não informado"}</p><div className={styles.priorityReasons}>{incident.priorityReasons.map((reason) => <span key={reason}>{reason}</span>)}</div></div>
        <div className={styles.queueMeta}><strong>{incident.assignedToName ?? "Não atribuído"}</strong><span>{incident.acknowledgedAt ? "Reconhecido" : "Não reconhecido"}</span><time>{incident.slaDeadline ? `SLA ${formatDateTime(incident.slaDeadline)}` : "Sem prazo de SLA"}</time></div>
      </li>)}</ol>
      <Pagination page={data.page} totalPages={data.totalPages} onChange={(page) => setQuery((current) => ({ ...current, page }))} />
    </>}
  </section>;
}
