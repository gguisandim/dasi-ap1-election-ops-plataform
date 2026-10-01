import { Badge, Button, EmptyState, ErrorState, Loading, Select, useAsync } from "@eops/ui";
import { useState } from "react";
import { Link } from "react-router-dom";
import { TasksNav } from "../components/TasksNav";
import { tasksService } from "../services/tasksService";
import { isTaskOverdue, TASK_PRIORITY_LABELS, TASK_STATUS_LABELS } from "../status";
import styles from "../styles/tasks.module.css";

const metricStyles = { warning: styles.warning, alert: styles.alert };

export function TasksDashboardPage() {
  const [electionId, setElectionId] = useState("");
  const references = useAsync(tasksService.references, []);
  const dashboard = useAsync(() => tasksService.dashboard({ electionId: electionId || undefined }), [electionId]);
  const data = dashboard.data;
  const metrics = data ? [
    ["Total", data.total, ""], ["Pendentes", data.pending, ""],
    ["Em andamento", data.inProgress, "warning"], ["Bloqueadas", data.blocked, "alert"],
    ["Concluídas", data.done, ""], ["Atrasadas", data.overdue, "alert"],
    ["Críticas", data.critical, "warning"],
  ] as const : [];
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
  </section>;
}