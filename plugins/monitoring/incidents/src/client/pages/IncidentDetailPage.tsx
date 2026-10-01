import { useState } from "react";
import { Breadcrumb, Button, Card, ErrorState, Input, LinkButton, Loading, Select, useAsync } from "@eops/ui";
import { formatDateTime, INCIDENT_STATUSES, INCIDENT_STATUS_LABELS, type IncidentStatus } from "@eops/shared";
import { IncidentStatusBadge, SeverityBadge } from "../components/IncidentBadge";
import { IncidentTimeline } from "../components/IncidentTimeline";
import { incidentService } from "../services/incidentService";
import { useParams } from "react-router-dom";
import styles from "../styles/incidents.module.css";

export function IncidentDetailPage() {
  const { id = "" } = useParams(); const { data, error, loading, reload } = useAsync(() => incidentService.get(id), [id]);
  const [status, setStatus] = useState<IncidentStatus>("IN_PROGRESS"); const [assignee, setAssignee] = useState(""); const [comment, setComment] = useState(""); const [actionError, setActionError] = useState<unknown>();
  async function act(operation: () => Promise<unknown>) { setActionError(undefined); try { await operation(); reload(); } catch (cause) { setActionError(cause); } }
  if (loading) return <Loading />; if (error || !data) return <ErrorState error={error ?? new Error("Incidente não encontrado.")} onRetry={reload} />;
  return <section className={styles.page}>
    <Breadcrumb items={[{ label: "Incidentes", to: "/incidents" }, ...(data.electoralZone ? [{ label: `Zona ${data.electoralZone.number}`, to: `/electoral-zones/${data.electoralZone.id}` }] : []), ...(data.pollingPlace ? [{ label: data.pollingPlace.name, to: `/polling-places/${data.pollingPlace.id}` }] : []), { label: data.code }]} />
    <header className={styles.header}><div><div className={styles.badges}><SeverityBadge severity={data.severity} /><IncidentStatusBadge status={data.status} />{data.isSimulated && <span className={styles.simulated}>SIMULADO</span>}</div><h1>{data.code} · {data.title}</h1><p>{data.description}</p></div><LinkButton secondary to={`/incidents/${id}/edit`}>Editar</LinkButton></header>
    {actionError !== undefined && <ErrorState error={actionError} />}
    <div className={styles.detailGrid}><Card><h2>Contexto operacional</h2><dl><dt>Categoria</dt><dd>{data.category.name}</dd><dt>Pleito</dt><dd>{data.election.name}</dd><dt>Zona</dt><dd>{data.electoralZone ? `Zona ${data.electoralZone.number}` : "—"}</dd><dt>Local</dt><dd>{data.pollingPlace?.name ?? "—"}</dd><dt>Responsável</dt><dd>{data.assignedToName ?? "Não atribuído"}</dd><dt>Abertura</dt><dd>{formatDateTime(data.openedAt)}</dd><dt>SLA</dt><dd className={data.slaOverdue ? styles.overdue : ""}>{data.slaDeadline ? formatDateTime(data.slaDeadline) : "—"}</dd></dl></Card>
      <Card><h2>Ações</h2><div className={styles.actions}><Select aria-label="Novo status" value={status} onChange={(event) => setStatus(event.target.value as IncidentStatus)}>{INCIDENT_STATUSES.map((item) => <option key={item} value={item}>{INCIDENT_STATUS_LABELS[item]}</option>)}</Select><Button onClick={() => void act(() => incidentService.changeStatus(id, status))}>Alterar status</Button><Input aria-label="Nome do responsável" placeholder="Responsável" value={assignee} onChange={(event) => setAssignee(event.target.value)} /><Button disabled={!assignee.trim()} onClick={() => void act(() => incidentService.assign(id, assignee))}>Atribuir</Button><Input aria-label="Comentário" placeholder="Adicionar comentário" value={comment} onChange={(event) => setComment(event.target.value)} /><Button disabled={!comment.trim()} onClick={() => void act(async () => { await incidentService.comment(id, comment); setComment(""); })}>Comentar</Button></div></Card></div>
    <Card><h2>Timeline</h2><IncidentTimeline events={data.events} /></Card>
  </section>;
}
