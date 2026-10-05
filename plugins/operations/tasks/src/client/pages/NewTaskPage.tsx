import { Button, ErrorState, Field, Input, Loading, Select } from "@eops/ui";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { TasksNav } from "../components/TasksNav";
import {
  TASK_EXECUTION_MODE_LABELS,
  TASK_EXECUTION_MODES,
} from "../components/TaskFieldExecution";
import { tasksService } from "../services/tasksService";
import { TASK_PRIORITIES, TASK_PRIORITY_LABELS } from "../status";
import styles from "../styles/tasks.module.css";
import { useAsync } from "@eops/ui";

export function NewTaskPage() {
  const navigate = useNavigate();
  const references = useAsync(tasksService.references, []);
  const [form, setForm] = useState({ title: "", description: "", electionId: "", electoralZoneId: "", pollingPlaceId: "", assigneeId: "", priority: "MEDIUM", executionMode: "OFFICE", dueAt: "" });
  const [error, setError] = useState<Error>();
  const zones = references.data?.zones.filter((item) => item.electionId === form.electionId) ?? [];
  const places = references.data?.places.filter((item) => item.electoralZoneId === form.electoralZoneId) ?? [];
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(undefined);
    try {
      const created = await tasksService.create({ title: form.title, description: form.description || undefined, electionId: form.electionId, electoralZoneId: form.electoralZoneId || undefined, pollingPlaceId: form.pollingPlaceId || undefined, assigneeId: form.assigneeId || undefined, priority: form.priority, executionMode: form.executionMode, dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : undefined });
      navigate(`/tasks/${created.id}`);
    } catch (reason) { setError(reason instanceof Error ? reason : new Error("Não foi possível criar a tarefa.")); }
  }
  return <section className={styles.page}><TasksNav /><header className={styles.header}><div><span>NOVA ATIVIDADE</span><h1>Criar tarefa</h1><p>Defina escopo, prioridade, responsável e prazo.</p></div></header>{references.loading && <Loading />}{(references.error || error) && <ErrorState error={error ?? references.error} onRetry={references.reload} />}{references.data && <section className={styles.detailPanel}><form className={styles.form} onSubmit={submit}><Field label="Título"><Input required minLength={2} maxLength={180} value={form.title} onChange={(event) => setForm((old) => ({ ...old, title: event.target.value }))} /></Field><Field label="Pleito"><Select required value={form.electionId} onChange={(event) => setForm((old) => ({ ...old, electionId: event.target.value, electoralZoneId: "", pollingPlaceId: "" }))}><option value="">Selecione</option>{references.data.elections.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.year}</option>)}</Select></Field><Field label="Zona eleitoral"><Select disabled={!form.electionId} value={form.electoralZoneId} onChange={(event) => setForm((old) => ({ ...old, electoralZoneId: event.target.value, pollingPlaceId: "" }))}><option value="">Pleito geral</option>{zones.map((item) => <option key={item.id} value={item.id}>Zona {item.number} · {item.name}</option>)}</Select></Field><Field label="Local de votação"><Select disabled={!form.electionId} value={form.pollingPlaceId} onChange={(event) => { const place = references.data?.places.find((item) => item.id === event.target.value); setForm((old) => ({ ...old, pollingPlaceId: event.target.value, electoralZoneId: place?.electoralZoneId ?? old.electoralZoneId })); }}><option value="">Sem local específico</option>{(form.electoralZoneId ? places : references.data.places.filter((place) => zones.some((zone) => zone.id === place.electoralZoneId))).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field><Field label="Responsável"><Select value={form.assigneeId} onChange={(event) => setForm((old) => ({ ...old, assigneeId: event.target.value }))}><option value="">Sem responsável</option>{references.data.users.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field><Field label="Prioridade"><Select value={form.priority} onChange={(event) => setForm((old) => ({ ...old, priority: event.target.value }))}>{TASK_PRIORITIES.map((priority) => <option key={priority} value={priority}>{TASK_PRIORITY_LABELS[priority]}</option>)}</Select></Field><Field label="Execução"><Select value={form.executionMode} onChange={(event) => setForm((old) => ({ ...old, executionMode: event.target.value }))}>{TASK_EXECUTION_MODES.map((mode) => <option key={mode} value={mode}>{TASK_EXECUTION_MODE_LABELS[mode]}</option>)}</Select></Field><Field label="Prazo"><Input type="datetime-local" value={form.dueAt} onChange={(event) => setForm((old) => ({ ...old, dueAt: event.target.value }))} /></Field><Field label="Descrição"><textarea className={styles.wide} maxLength={5000} value={form.description} onChange={(event) => setForm((old) => ({ ...old, description: event.target.value }))} /></Field><div className={styles.formActions}><Button type="submit">Criar tarefa</Button></div></form></section>}</section>;
}