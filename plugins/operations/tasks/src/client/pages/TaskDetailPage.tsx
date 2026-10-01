import { Badge, Button, ErrorState, Field, Input, Loading, Select } from "@eops/ui";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import type { TaskPriority, TaskStatus } from "../../types";
import { TasksNav } from "../components/TasksNav";
import { tasksService } from "../services/tasksService";
import { isTaskOverdue, localDateTime, TASK_PRIORITIES, TASK_PRIORITY_LABELS, TASK_STATUSES, TASK_STATUS_LABELS } from "../status";
import styles from "../styles/tasks.module.css";
import { useAsync } from "@eops/ui";

export function TaskDetailPage() {
  const { id = "" } = useParams();
  const task = useAsync(() => tasksService.task(id), [id]);
  const references = useAsync(tasksService.references, []);
  const candidates = useAsync(() => tasksService.tasks({ electionId: task.data?.electionId }), [task.data?.electionId]);
  const [form, setForm] = useState({ title: "", description: "", assigneeId: "", priority: "MEDIUM" as TaskPriority, status: "PENDING" as TaskStatus, dueAt: "" });
  const [comment, setComment] = useState("");
  const [dependsOnId, setDependsOnId] = useState("");
  const [error, setError] = useState<Error>();
  useEffect(() => {
    if (task.data) setForm({ title: task.data.title, description: task.data.description ?? "", assigneeId: task.data.assigneeId ?? "", priority: task.data.priority, status: task.data.status, dueAt: localDateTime(task.data.dueAt) });
  }, [task.data]);
  async function refresh() { task.setData(await tasksService.task(id)); }
  async function act(action: () => Promise<unknown>) {
    setError(undefined);
    try { await action(); await refresh(); }
    catch (reason) { setError(reason instanceof Error ? reason : new Error("A operação não foi concluída.")); }
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    await act(() => tasksService.update(id, { title: form.title, description: form.description || null, assigneeId: form.assigneeId || null, priority: form.priority, status: form.status, dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : null }));
  }
  async function addComment(event: FormEvent) {
    event.preventDefault();
    const content = comment.trim();
    if (!content) return;
    await act(async () => { await tasksService.comment(id, content); setComment(""); });
  }
  async function addDependency(event: FormEvent) {
    event.preventDefault();
    if (!dependsOnId) return;
    await act(async () => { await tasksService.addDependency(id, dependsOnId); setDependsOnId(""); });
  }
  const current = task.data;
  const dependencyIds = new Set(current?.dependencies.map((item) => item.dependsOn.id) ?? []);
  const availableDependencies = candidates.data?.filter((item) => item.id !== id && !dependencyIds.has(item.id)) ?? [];
  return <section className={styles.page}><TasksNav /><p className={styles.muted}><Link to="/tasks/list">Tarefas</Link> / Detalhes</p>{task.loading && <Loading />}{(task.error || error) && <ErrorState error={error ?? task.error} onRetry={task.reload} />}{current && <><header className={styles.detailHeading}><div><span>{current.election.name}{current.electoralZone ? ` · Zona ${current.electoralZone.number}` : ""}</span><h1>{current.title}</h1><p className={styles.muted}>{current.pollingPlace?.name ?? (current.electoralZone ? current.electoralZone.name : "Tarefa geral do pleito")}</p></div><div className={styles.headerActions}><Badge tone={current.priority === "CRITICAL" ? "danger" : current.priority === "HIGH" ? "warning" : "neutral"}>{TASK_PRIORITY_LABELS[current.priority]}</Badge><Badge tone={isTaskOverdue(current) ? "danger" : current.status === "DONE" ? "success" : "neutral"}>{isTaskOverdue(current) ? "Atrasada" : current.blockedByDependencies ? "Bloqueada por dependências" : TASK_STATUS_LABELS[current.status]}</Badge></div></header>
    <div className={styles.detailGrid}><div className={styles.detailMain}><section className={styles.detailPanel}><h2>Informações da tarefa</h2><form className={styles.detailFields} onSubmit={save}><Field label="Título"><Input required minLength={2} maxLength={180} value={form.title} onChange={(event) => setForm((old) => ({ ...old, title: event.target.value }))} /></Field><Field label="Responsável"><Select value={form.assigneeId} onChange={(event) => setForm((old) => ({ ...old, assigneeId: event.target.value }))}><option value="">Sem responsável</option>{references.data?.users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</Select></Field><Field label="Prioridade"><Select value={form.priority} onChange={(event) => setForm((old) => ({ ...old, priority: event.target.value as TaskPriority }))}>{TASK_PRIORITIES.map((priority) => <option key={priority} value={priority}>{TASK_PRIORITY_LABELS[priority]}</option>)}</Select></Field><Field label="Status"><Select value={form.status} onChange={(event) => setForm((old) => ({ ...old, status: event.target.value as TaskStatus }))}>{TASK_STATUSES.map((status) => <option key={status} value={status}>{TASK_STATUS_LABELS[status]}</option>)}</Select></Field><Field label="Prazo"><Input type="datetime-local" value={form.dueAt} onChange={(event) => setForm((old) => ({ ...old, dueAt: event.target.value }))} /></Field><Field label="Descrição"><textarea maxLength={5000} value={form.description} onChange={(event) => setForm((old) => ({ ...old, description: event.target.value }))} /></Field><div className={styles.formActions}><Button type="submit">Salvar alterações</Button></div></form><p className={styles.muted}>Criada por {current.createdBy?.name ?? "usuário removido"} em {new Date(current.createdAt).toLocaleString("pt-BR")}{current.completedAt && ` · Concluída em ${new Date(current.completedAt).toLocaleString("pt-BR")}`}</p></section>
      <section className={styles.detailPanel}><div className={styles.sectionHeading}><h2>Dependências</h2><Badge>{current.dependencies.length}</Badge></div>{current.blockedByDependencies && <p className={styles.inlineError}>Esta tarefa aguarda a conclusão das dependências abaixo.</p>}<div className={styles.dependencyList}>{current.dependencies.map(({ dependsOn }) => <div className={styles.dependencyRow} key={dependsOn.id}><div><Link to={`/tasks/${dependsOn.id}`}>{dependsOn.title}</Link><small>{TASK_STATUS_LABELS[dependsOn.status]} · {TASK_PRIORITY_LABELS[dependsOn.priority]}</small></div><Button type="button" onClick={() => void act(() => tasksService.removeDependency(id, dependsOn.id))}>Remover</Button></div>)}{!current.dependencies.length && <p className={styles.muted}>Esta tarefa não depende de outras atividades.</p>}</div><form className={styles.dependencyForm} onSubmit={addDependency}><Field label="Adicionar dependência"><Select value={dependsOnId} onChange={(event) => setDependsOnId(event.target.value)}><option value="">Selecione uma tarefa</option>{availableDependencies.map((item) => <option key={item.id} value={item.id}>{item.title} · {TASK_STATUS_LABELS[item.status]}</option>)}</Select></Field><Button type="submit" disabled={!dependsOnId}>Adicionar</Button></form></section>
      <section className={styles.detailPanel}><div className={styles.sectionHeading}><h2>Comentários</h2><Badge>{current.comments.length}</Badge></div><form className={styles.commentForm} onSubmit={addComment}><Field label="Novo comentário"><textarea required maxLength={4000} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Registre uma atualização operacional" /></Field><Button type="submit" disabled={!comment.trim()}>Adicionar comentário</Button></form><div className={styles.comments}>{current.comments.map((item) => <article className={styles.comment} key={item.id}><div className={styles.commentHeading}><strong>{item.author?.name ?? "Usuário removido"}</strong><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString("pt-BR")}</time></div><p>{item.content}</p></article>)}{!current.comments.length && <p className={styles.muted}>Nenhum comentário registrado.</p>}</div></section></div>
      <aside className={styles.detailSide}><section className={styles.detailPanel}><div className={styles.sectionHeading}><h2>Histórico</h2><Badge>{current.history.length}</Badge></div><ol className={styles.history}>{current.history.map((entry) => <li key={entry.id}><p>{entry.message}</p><small>{entry.actor?.name ?? "Sistema"}</small><time dateTime={entry.createdAt}>{new Date(entry.createdAt).toLocaleString("pt-BR")}</time></li>)}</ol></section></aside></div></>}</section>;
}