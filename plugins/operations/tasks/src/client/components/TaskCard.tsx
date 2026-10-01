import { Badge, Select } from "@eops/ui";
import { Link } from "react-router-dom";
import type { Task, TaskStatus } from "../../types";
import { isTaskOverdue, TASK_PRIORITY_LABELS, TASK_STATUSES, TASK_STATUS_LABELS } from "../status";
import styles from "../styles/tasks.module.css";

export function TaskCard({ task, onStatusChange }: { task: Task; onStatusChange?: (status: TaskStatus) => void }) {
  const displayStatus = task.blockedByDependencies ? "BLOCKED" : task.status;
  return <article className={styles.taskCard}>
    <div className={styles.cardTop}><Badge tone={task.priority === "CRITICAL" ? "danger" : task.priority === "HIGH" ? "warning" : "neutral"}>{TASK_PRIORITY_LABELS[task.priority]}</Badge>{isTaskOverdue(task) && <Badge tone="danger">Atrasada</Badge>}</div>
    <Link className={styles.taskTitle} to={`/tasks/${task.id}`}>{task.title}</Link>
    <div className={styles.taskMeta}><span>{task.assignee?.name ?? "Sem responsável"}</span><span>{task.pollingPlace?.name ?? (task.electoralZone ? `Zona ${task.electoralZone.number}` : task.election.name)}</span></div>
    {task.dueAt && <time className={isTaskOverdue(task) ? styles.overdue : ""} dateTime={task.dueAt}>{new Date(task.dueAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</time>}
    {task.blockedByDependencies && <small className={styles.blockedNote}>Aguardando {task.dependencies.filter(({ dependsOn }) => dependsOn.status !== "DONE").length} dependência(s)</small>}
    {onStatusChange && <Select aria-label={`Status de ${task.title}`} value={displayStatus} onChange={(event) => onStatusChange(event.target.value as TaskStatus)}>{TASK_STATUSES.filter((status) => status !== "CANCELLED").map((status) => <option key={status} value={status}>{TASK_STATUS_LABELS[status]}</option>)}<option value="CANCELLED">Cancelar</option></Select>}
  </article>;
}