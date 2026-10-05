import { Badge, Button, EmptyState, ErrorState, Loading, Select, useAsync } from "@eops/ui";
import { useState } from "react";
import { Link } from "react-router-dom";
import type { TaskPriority, TaskStatus } from "../../types";
import { TasksNav } from "../components/TasksNav";
import { tasksService } from "../services/tasksService";
import { isTaskOverdue, TASK_PRIORITIES, TASK_PRIORITY_LABELS, TASK_STATUSES, TASK_STATUS_LABELS } from "../status";
import styles from "../styles/tasks.module.css";

const metricStyles = { warning: styles.warning, alert: styles.alert };
const maxCount = (values: number[]) => Math.max(1, ...values);

export function TasksDashboardPage() {
  const [electionId, setElectionId] = useState("");
  const references = useAsync(tasksService.references, []);
  const dashboard = useAsync(() => tasksService.dashboard({ electionId: electionId || undefined }), [electionId]);
  const workload = useAsync(() => tasksService.workload({ electionId: electionId || undefined }), [electionId]);
  const data = dashboard.data;
  const metrics = data ? [
    ["Total", data.total, ""], ["Pendentes", data.pending, ""],
    ["Em andamento", data.inProgress, "warning"], ["Bloqueadas", data.blocked, "alert"],
    ["Concluídas", data.done, ""], ["Atrasadas", data.overdue, "alert"],
    ["Críticas", data.critical, "warning"],
  ] as const : [];
  const statusRows = workload.data ? TASK_STATUSES.map((status) => ({ status, count: workload.data!.byStatus[status] ?? 0 })) : [];
  const priorityRows = workload.data ? TASK_PRIORITIES.map((priority) => ({ priority, count: workload.data!.byPriority[priority] ?? 0 })) : [];
  const statusMax = maxCount(statusRows.map((row) => row.count));
  const priorityMax = maxCount(priorityRows.map((row) => row.count));
  const teamMax = maxCount(workload.data?.byTeam.map((row) => row.count) ?? [1]);
  return <section className={styles.page}>
    <TasksNav />
    <header className={styles.header}>
      <div><span>OPERAÇÕES · PLANEJAMENTO</span><h1>Central de Tarefas</h1><p>Ritmo operacional, prioridades e pendências do pleito.</p></div>
      <div className={styles.headerActions}>
        <Select aria-label="Filtrar pleito" value={electionId} onChange={(event) => setElectionId(event.target.value)}>
          <option value="">Todos os pleitos</option>{references.data?.elections.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </Select>
        <Link className={styles.primaryLink} to="/tasks/new">Nova tarefa</Link>
      </div>
    </header>
    {dashboard.loading && <Loading label="Carregando indicadores…" />}
    {(dashboard.error || references.error) && <ErrorState error={dashboard.error ?? references.error} onRetry={() => { dashboard.reload(); references.reload(); }} />}
    {data && <>
      <div className={styles.metrics}>{metrics.map(([label, value, tone]) => <div className={`${styles.metric} ${tone ? metricStyles[tone] : ""}`} key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
      <section className={styles.attention}>
        <div className={styles.sectionHeading}><h2>Precisam de atenção</h2><Badge tone={data.attentionTasks.length ? "danger" : "success"}>{data.attentionTasks.length}</Badge></div>
        {data.attentionTasks.length ? <div className={styles.attentionList}>{data.attentionTasks.map((task) => <div className={styles.attentionRow} key={task.id}>
          <div><Link to={`/tasks/${task.id}`}>{task.title}</Link><small>{task.election.name}</small></div>
          <Badge tone={task.priority === "CRITICAL" ? "danger" : "warning"}>{TASK_PRIORITY_LABELS[task.priority]}</Badge>
          <span>{task.assignee?.name ?? "Sem responsável"}</span>
          <span>{task.pollingPlace?.name ?? (task.electoralZone ? `Zona ${task.electoralZone.number}` : "Pleito geral")}</span>
          <span className={isTaskOverdue(task) ? styles.overdue : ""}>{isTaskOverdue(task) ? "Atrasada" : task.blockedByDependencies ? "Dependências abertas" : TASK_STATUS_LABELS[task.status]}</span>
        </div>)}</div> : <EmptyState title="Tudo em ordem" description="Não há tarefas críticas, atrasadas ou bloqueadas neste recorte." action={<Button onClick={() => dashboard.reload()}>Atualizar</Button>} />}
      </section>
    </>}
    <section className={styles.detailPanel}>
      <div className={styles.sectionHeading}><h2>Carga de trabalho</h2>{workload.data && <Badge>{workload.data.byAssignee.reduce((total, row) => total + row.total, 0)} tarefas</Badge>}</div>
      {workload.loading && <Loading label="Carregando carga de trabalho…" />}
      {workload.error && <ErrorState error={workload.error} onRetry={workload.reload} />}
      {workload.data && (workload.data.byAssignee.length ? <div className={styles.workloadGrid}>
        <div>
          <h3>Por responsável</h3>
          <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Responsável</th><th>Total</th><th>Pendentes</th><th>Em andamento</th><th>Bloqueadas</th><th>Atrasadas</th><th>Críticas</th></tr></thead><tbody>
            {workload.data.byAssignee.map((row) => <tr key={row.assigneeId ?? "none"}><td>{row.name}</td><td>{row.total}</td><td>{row.pending}</td><td>{row.inProgress}</td><td className={row.blocked ? styles.overdue : ""}>{row.blocked}</td><td className={row.overdue ? styles.overdue : ""}>{row.overdue}</td><td>{row.critical}</td></tr>)}
          </tbody></table></div>
        </div>
        <div className={styles.workloadSide}>
          <div>
            <h3>Por equipe de campo</h3>
            <ul className={styles.barList}>{workload.data.byTeam.map((row) => <li key={row.teamId ?? "none"}><span>{row.teamName}</span><div className={styles.bar}><i style={{ width: `${(row.count / teamMax) * 100}%` }} /></div><strong>{row.count}</strong></li>)}</ul>
            {!workload.data.byTeam.length && <p className={styles.muted}>Sem tarefas no recorte.</p>}
          </div>
          <div>
            <h3>Por status</h3>
            <ul className={styles.barList}>{statusRows.map((row) => <li key={row.status}><span>{TASK_STATUS_LABELS[row.status as TaskStatus]}</span><div className={styles.bar}><i style={{ width: `${(row.count / statusMax) * 100}%` }} /></div><strong>{row.count}</strong></li>)}</ul>
          </div>
          <div>
            <h3>Por prioridade</h3>
            <ul className={styles.barList}>{priorityRows.map((row) => <li key={row.priority}><span>{TASK_PRIORITY_LABELS[row.priority as TaskPriority]}</span><div className={styles.bar}><i style={{ width: `${(row.count / priorityMax) * 100}%` }} /></div><strong>{row.count}</strong></li>)}</ul>
          </div>
        </div>
      </div> : <EmptyState title="Sem carga de trabalho" description="Nenhuma tarefa encontrada para o recorte selecionado." />)}
    </section>
  </section>;
}
