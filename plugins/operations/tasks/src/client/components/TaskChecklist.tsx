import { Badge, Button, Field, Input } from "@eops/ui";
import { useState, type FormEvent } from "react";
import type { Task } from "../../types";
import { tasksService } from "../services/tasksService";
import styles from "../styles/tasks.module.css";

export function TaskChecklist({ task, onSaved }: { task: Task; onSaved: () => Promise<void> | void }) {
  const [title, setTitle] = useState("");
  const [error, setError] = useState<Error>();
  const items = task.checklistItems;
  const done = items.filter((item) => item.done).length;

  async function run(action: () => Promise<unknown>) {
    setError(undefined);
    try { await action(); await onSaved(); }
    catch (reason) { setError(reason instanceof Error ? reason : new Error("Não foi possível atualizar o checklist.")); }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const value = title.trim();
    if (!value) return;
    await run(async () => { await tasksService.addChecklistItem(task.id, { title: value }); setTitle(""); });
  }

  return <section className={styles.detailPanel}>
    <div className={styles.sectionHeading}><h2>Checklist interno</h2><Badge tone={items.length && done === items.length ? "success" : "neutral"}>{done}/{items.length}</Badge></div>
    {error && <p className={styles.inlineError}>{error.message}</p>}
    <ul className={styles.checklist}>
      {items.map((item) => <li key={item.id} className={item.done ? styles.checklistDone : ""}>
        <label className={styles.checklistToggle}>
          <input type="checkbox" checked={item.done} onChange={() => void run(() => tasksService.updateChecklistItem(item.id, { done: !item.done }))} />
          <span>{item.title}</span>
        </label>
        <Button type="button" secondary onClick={() => void run(() => tasksService.deleteChecklistItem(item.id))}>Remover</Button>
      </li>)}
      {!items.length && <p className={styles.muted}>Nenhum passo interno registrado.</p>}
    </ul>
    <form className={styles.inlineForm} onSubmit={submit}>
      <Field label="Novo passo" className={styles.grow}><Input required maxLength={240} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Pequeno passo interno da tarefa" /></Field>
      <Button type="submit" disabled={!title.trim()}>Adicionar</Button>
    </form>
    <p className={styles.muted}>O checklist interno não bloqueia transições de status e não substitui os checklists de preparação.</p>
  </section>;
}
