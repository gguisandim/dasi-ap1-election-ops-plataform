import { Badge, ErrorState, Loading, Select } from "@eops/ui";
import { useState } from "react";
import { Link } from "react-router-dom";
import type { TaskStatus } from "../../types";
import { TaskCard } from "../components/TaskCard";
import { TasksNav } from "../components/TasksNav";
import { tasksService } from "../services/tasksService";
import { TASK_STATUS_LABELS } from "../status";
import styles from "../styles/tasks.module.css";
import { useAsync } from "@eops/ui";

const columns: TaskStatus[] = ["PENDING", "IN_PROGRESS", "BLOCKED", "DONE"];

export function TasksKanbanPage() {
  const [electionId, setElectionId] = useState("");
  const [actionError, setActionError] = useState<Error>();
  const references = useAsync(tasksService.references, []);
  const tasks = useAsync(() => tasksService.tasks({ electionId: electionId || undefined }), [electionId]);
  async function move(taskId: string, status: TaskStatus) {
    setActionError(undefined);
    try { await tasksService.update(taskId, { status }); tasks.reload(); }
    catch (reason) { setActionError(reason instanceof Error ? reason : new Error("Não foi possível alterar o status.")); }
  }
  return <section className={styles.page}><TasksNav /><header className={styles.header}><div><span>ACOMPANHAMENTO VISUAL</span><h1>Kanban de tarefas</h1><p>Mova as tarefas entre etapas; dependências em aberto aparecem bloqueadas.</p></div><div className={styles.headerActions}><Select aria-label="Filtrar pleito" value={electionId} onChange={(event) => setElectionId(event.target.value)}><option value="">Todos os pleitos</option>{references.data?.elections.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select><Link className={styles.primaryLink} to="/tasks/new">Nova tarefa</Link></div></header>{actionError && <ErrorState error={actionError} />}{tasks.loading && <Loading label="Carregando quadro…" />}{tasks.error && <ErrorState error={tasks.error} onRetry={tasks.reload} />}{tasks.data && <div className={styles.kanban}>{columns.map((status) => {
    const rows = tasks.data!.filter((task) => (task.blockedByDependencies ? "BLOCKED" : task.status) === status);
    return <section className={styles.kanbanColumn} key={status}><div className={styles.columnHeading}><span>{TASK_STATUS_LABELS[status]}</span><Badge>{rows.length}</Badge></div><div className={styles.columnTasks}>{rows.length ? rows.map((task) => <TaskCard key={task.id} task={task} onStatusChange={(next) => void move(task.id, next)} />) : <p className={styles.empty}>Sem tarefas</p>}</div></section>;
  })}</div>}</section>;
}