import { useMemo, useState } from "react";
import { Breadcrumb, Button, Card, EmptyState, ErrorState, Input, LinkButton, Loading, Select, useAsync } from "@eops/ui";
import { formatDateTime } from "@eops/shared/format";
import { getAllowedIncidentTransitions, INCIDENT_STATUS_LABELS, type IncidentStatus } from "@eops/shared/incidents";
import { useParams } from "react-router-dom";
import { IncidentStatusBadge, SeverityBadge } from "../components/IncidentBadge";
import { IncidentTimeline } from "../components/IncidentTimeline";
import { incidentService } from "../services/incidentService";
import styles from "../styles/incidents.module.css";

type DetailTab = "summary" | "attendance" | "timeline" | "assignments";
const slaLabels = { OVERDUE: "Vencido", DUE_SOON: "Próximo", ON_TRACK: "No prazo", COMPLETED: "Concluído" } as const;

export function IncidentDetailPage() {
  const { id = "" } = useParams();
  const { data, error, loading, reload } = useAsync(() => incidentService.get(id), [id]);
  const [tab, setTab] = useState<DetailTab>("summary");
  const [status, setStatus] = useState<IncidentStatus>("IN_PROGRESS");
  const [assignee, setAssignee] = useState(""); const [assignmentReason, setAssignmentReason] = useState("");
  const [comment, setComment] = useState(""); const [reason, setReason] = useState("");
  const [escalationLevel, setEscalationLevel] = useState(1); const [actionError, setActionError] = useState<unknown>();
  const actions = useMemo(() => new Set(data?.availableActions ?? []), [data?.availableActions]);
  const statusOptions = data ? getAllowedIncidentTransitions(data.status).filter((item) => !["RESOLVED", "CLOSED", "CANCELLED"].includes(item)) : [];
  const escalationLevels = data ? [1, 2, 3].filter((level) => level > data.escalationLevel) : [];
  async function act(operation: () => Promise<unknown>, clear?: () => void) { setActionError(undefined); try { await operation(); clear?.(); reload(); } catch (cause) { setActionError(cause); } }
  if (loading) return <Loading />;
  if (error || !data) return <ErrorState error={error ?? new Error("Incidente não encontrado.")} onRetry={reload} />;
  return <section className={styles.page}>
    <Breadcrumb items={[{ label: "Incidentes", to: "/incidents" }, ...(data.electoralZone ? [{ label: `Zona ${data.electoralZone.number}`, to: `/electoral-zones/${data.electoralZone.id}` }] : []), ...(data.pollingPlace ? [{ label: data.pollingPlace.name, to: `/polling-places/${data.pollingPlace.id}` }] : []), { label: data.code }]} />
    <header className={styles.header}><div><div className={styles.badges}><SeverityBadge severity={data.severity} /><IncidentStatusBadge status={data.status} /><span className={`${styles.slaBadge} ${styles[data.slaState.toLowerCase()]}`}>SLA {slaLabels[data.slaState]}</span>{data.escalationLevel > 0 && <span className={styles.escalated}>Escalado N{data.escalationLevel}</span>}{data.isSimulated && <span className={styles.simulated}>SIMULADO</span>}</div><h1>{data.code} · {data.title}</h1><p>{data.description}</p></div>{actions.has("EDIT") && <LinkButton secondary to={`/incidents/${id}/edit`}>Editar</LinkButton>}</header>
    {actionError !== undefined && <ErrorState error={actionError} />}
    <nav className={styles.tabs} aria-label="Seções do incidente">{([['summary', 'Resumo'], ['attendance', 'Atendimento'], ['timeline', 'Timeline'], ['assignments', 'Atribuições']] as const).map(([value, label]) => <button key={value} type="button" aria-current={tab === value ? "page" : undefined} onClick={() => setTab(value)}>{label}</button>)}</nav>
    {tab === "summary" && <div className={styles.detailGrid}>
      <Card><h2>Contexto operacional</h2><dl><dt>Categoria</dt><dd>{data.category.name}</dd><dt>Pleito</dt><dd>{data.election.name}</dd><dt>Zona</dt><dd>{data.electoralZone ? `Zona ${data.electoralZone.number}` : "—"}</dd><dt>Local</dt><dd>{data.pollingPlace?.name ?? "—"}</dd><dt>Ativo</dt><dd>{data.asset ? `${data.asset.assetTag} · ${data.asset.name}` : "—"}</dd><dt>Responsável</dt><dd>{data.assignedToName ?? "Não atribuído"}</dd></dl></Card>
      <Card><h2>Estado e prazos</h2><dl><dt>Status</dt><dd><IncidentStatusBadge status={data.status} /></dd><dt>Severidade</dt><dd><SeverityBadge severity={data.severity} /></dd><dt>Abertura</dt><dd>{formatDateTime(data.openedAt)}</dd><dt>SLA</dt><dd className={data.slaState === "OVERDUE" ? styles.overdue : ""}>{data.slaDeadline ? formatDateTime(data.slaDeadline) : "Sem prazo"}</dd><dt>Reconhecimento</dt><dd>{data.acknowledgedAt ? formatDateTime(data.acknowledgedAt) : "Pendente"}</dd><dt>Escalonamento</dt><dd>{data.escalationLevel ? `Nível ${data.escalationLevel} · ${data.escalationReason ?? "sem motivo"}` : "Não escalado"}</dd><dt>Resolução</dt><dd>{data.resolvedAt ? formatDateTime(data.resolvedAt) : "—"}</dd><dt>Fechamento</dt><dd>{data.closedAt ? formatDateTime(data.closedAt) : "—"}</dd></dl></Card>
    </div>}
    {tab === "attendance" && <div className={styles.detailGrid}>
      <Card><h2>Ações disponíveis</h2><div className={styles.actions}>
        {actions.has("ACKNOWLEDGE") && <Button onClick={() => void act(() => incidentService.acknowledge(id))}>Reconhecer incidente</Button>}
        {actions.has("CHANGE_STATUS") && statusOptions.length > 0 && <div className={styles.inlineAction}><Select aria-label="Novo status" value={statusOptions.includes(status) ? status : statusOptions[0]} onChange={(event) => setStatus(event.target.value as IncidentStatus)}>{statusOptions.map((item) => <option key={item} value={item}>{INCIDENT_STATUS_LABELS[item]}</option>)}</Select><Button onClick={() => void act(() => incidentService.changeStatus(id, statusOptions.includes(status) ? status : statusOptions[0]))}>Alterar status</Button></div>}
        {(actions.has("RESOLVE") || actions.has("REOPEN") || actions.has("CLOSE") || actions.has("CANCEL")) && <Input aria-label="Motivo da ação" placeholder="Motivo (opcional)" value={reason} onChange={(event) => setReason(event.target.value)} />}
        <div className={styles.formActions}>{actions.has("RESOLVE") && <Button onClick={() => void act(() => incidentService.resolve(id, reason), () => setReason(""))}>Resolver</Button>}{actions.has("REOPEN") && <Button onClick={() => void act(() => incidentService.reopen(id, reason), () => setReason(""))}>Reabrir</Button>}{actions.has("CLOSE") && <Button onClick={() => void act(() => incidentService.close(id, reason), () => setReason(""))}>Fechar</Button>}{actions.has("CANCEL") && <Button secondary onClick={() => void act(() => incidentService.remove(id))}>Cancelar incidente</Button>}</div>
        {actions.size === 0 && <EmptyState title="Sem ações disponíveis" description="O status atual e suas permissões não permitem novas mutações." />}
      </div></Card>
      <Card><h2>Escalonamento e comunicação</h2><div className={styles.actions}>{actions.has("ESCALATE") && escalationLevels.length > 0 && <><Select aria-label="Nível de escalonamento" value={escalationLevels.includes(escalationLevel) ? escalationLevel : escalationLevels[0]} onChange={(event) => setEscalationLevel(Number(event.target.value))}>{escalationLevels.map((level) => <option key={level} value={level}>Nível {level}</option>)}</Select><Input aria-label="Motivo do escalonamento" placeholder="Motivo do escalonamento" value={reason} onChange={(event) => setReason(event.target.value)} /><Button disabled={reason.trim().length < 3} onClick={() => void act(() => incidentService.escalate(id, escalationLevels.includes(escalationLevel) ? escalationLevel : escalationLevels[0], reason), () => setReason(""))}>Escalar</Button></>}{actions.has("COMMENT") && <><Input aria-label="Comentário" placeholder="Adicionar comentário" value={comment} onChange={(event) => setComment(event.target.value)} /><Button disabled={!comment.trim()} onClick={() => void act(() => incidentService.comment(id, comment), () => setComment(""))}>Comentar</Button></>}</div></Card>
    </div>}
    {tab === "timeline" && <Card><h2>Timeline</h2><IncidentTimeline events={data.events} /></Card>}
    {tab === "assignments" && <div className={styles.detailGrid}><Card><h2>Nova atribuição</h2>{actions.has("ASSIGN") ? <div className={styles.actions}><Input aria-label="Nome do responsável" placeholder="Responsável" value={assignee} onChange={(event) => setAssignee(event.target.value)} /><Input aria-label="Motivo da atribuição" placeholder="Motivo" value={assignmentReason} onChange={(event) => setAssignmentReason(event.target.value)} /><Button disabled={!assignee.trim()} onClick={() => void act(() => incidentService.assign(id, assignee, assignmentReason || undefined), () => { setAssignee(""); setAssignmentReason(""); })}>Atribuir</Button></div> : <p className={styles.muted}>Você não pode alterar a atribuição neste estado.</p>}</Card><Card><h2>Histórico de atribuições</h2>{!data.assignments?.length ? <EmptyState title="Sem atribuições" description="Nenhum responsável foi atribuído." /> : <ol className={styles.assignmentList}>{data.assignments.map((assignment) => <li key={assignment.id}><strong>{assignment.assignedToName}</strong><span>Início: {formatDateTime(assignment.assignedAt)}</span><span>Fim: {assignment.endedAt ? formatDateTime(assignment.endedAt) : "Atual"}</span><p>{assignment.reason ?? "Sem motivo informado"}</p></li>)}</ol>}</Card></div>}
  </section>;
}
