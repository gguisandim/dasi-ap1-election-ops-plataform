import { Badge, Button, Field, Input, Select, useAsync } from "@eops/ui";
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import type { Task, TaskPriority } from "../../types";
import { tasksService } from "../services/tasksService";
import { TASK_PRIORITIES, TASK_PRIORITY_LABELS, TASK_STATUS_LABELS } from "../status";
import styles from "../styles/tasks.module.css";

export function TaskSubtasks({ task, onSaved }: { task: Task; onSaved: () => Promise<void> | void }) {
  const references = useAsync(tasksService.references, []);
  const [title, setTitle] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("MEDIUM");
  const [error, setError] = useState<Error>();
  const canNest = !task.parentId;

  async function submit(event: FormEvent) {
    event.preventDefault();
    const value = title.trim();
    if (!value) return;
    setError(undefined);
    try {
      await tasksService.createSubtask(task.id, { title: value, assigneeId: assigneeId || undefined, priority });
      setTitle("");
      setAssigneeId("");
      setPriority("MEDIUM");
      await onSaved();
    } catch (reason) {
      setError(reason instanceof Error ? reason : new Error("Não foi possível criar a subtarefa."));
    }
  }

  const done = task.subtasks.filter((item) => item.status === "DONE" || item.status === "CANCELLED").length;
  return <section className={styles.detailPanel}>
    <div className={styles.sectionHeading}><h2>Subtarefas</h2><Badge>{done}/{task.subtasks.length}</Badge></div>
    {task.parent && <p className={styles.muted}>Subtarefa de <Link to={`/tasks/${task.parent.id}`}>{task.parent.title}</Link>.</p>}
    {error && <p className={styles.inlineError}>{error.message}</p>}
    <div className={styles.dependencyList}>
      {task.subtasks.map((item) => <div className={styles.dependencyRow} key={item.id}>
        <div><Link to={`/tasks/${item.id}`}>{item.title}</Link><small>{TASK_STATUS_LABELS[item.status]} · {TASK_PRIORITY_LABELS[item.priority]}</small></div>
        <Badge tone={item.status === "DONE" ? "success" : item.status === "CANCELLED" ? "neutral" : "warning"}>{TASK_STATUS_LABELS[item.status]}</Badge>
      </div>)}
      {!task.subtasks.length && <p className={styles.muted}>Nenhuma subtarefa cadastrada.</p>}
    </div>
    {!canNest && <p className={styles.muted}>Este nível já é uma subtarefa; a hierarquia máxima é de dois níveis.</p>}
    {canNest && <form className={styles.inlineForm} onSubmit={submit}>
      <Field label="Nova subtarefa" className={styles.grow}><Input required minLength={2} maxLength={180} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Passo que compõe esta tarefa" /></Field>
      <Field label="Responsável"><Select value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)}><option value="">Sem responsável</option>{references.data?.users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</Select></Field>
      <Field label="Prioridade"><Select value={priority} onChange={(event) => setPriority(event.target.value as TaskPriority)}>{TASK_PRIORITIES.map((value) => <option key={value} value={value}>{TASK_PRIORITY_LABELS[value]}</option>)}</Select></Field>
      <Button type="submit" disabled={!title.trim()}>Adicionar</Button>
    </form>}
  </section>;
}
