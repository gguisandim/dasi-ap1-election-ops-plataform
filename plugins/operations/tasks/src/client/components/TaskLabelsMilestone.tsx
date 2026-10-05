import { Badge, Button, Field, Input, Select, useAsync } from "@eops/ui";
import { useState, type FormEvent } from "react";
import type { Task } from "../../types";
import { tasksService } from "../services/tasksService";
import styles from "../styles/tasks.module.css";

export function TaskLabelsMilestone({ task, onSaved }: { task: Task; onSaved: () => Promise<void> | void }) {
  const labels = useAsync(tasksService.labels, []);
  const milestones = useAsync(() => tasksService.milestones(task.electionId), [task.electionId]);
  const [newLabel, setNewLabel] = useState("");
  const [milestoneName, setMilestoneName] = useState("");
  const [error, setError] = useState<Error>();
  const selectedLabelIds = task.labels.map((item) => item.label.id);

  async function run(action: () => Promise<unknown>) {
    setError(undefined);
    try { await action(); await onSaved(); }
    catch (reason) { setError(reason instanceof Error ? reason : new Error("Não foi possível atualizar rótulos ou marcos.")); }
  }

  async function createLabel(event: FormEvent) {
    event.preventDefault();
    const value = newLabel.trim();
    if (!value) return;
    await run(async () => { await tasksService.createLabel(value); setNewLabel(""); labels.reload(); });
  }

  async function createMilestone(event: FormEvent) {
    event.preventDefault();
    const value = milestoneName.trim();
    if (!value) return;
    await run(async () => { await tasksService.createMilestone({ electionId: task.electionId, name: value }); setMilestoneName(""); milestones.reload(); });
  }

  return <>
    <section className={styles.detailPanel}>
      <div className={styles.sectionHeading}><h2>Rótulos</h2><Badge>{selectedLabelIds.length}</Badge></div>
      {error && <p className={styles.inlineError}>{error.message}</p>}
      <div className={styles.labelRow}>{task.labels.map((item) => <Badge key={item.label.id}>{item.label.name}</Badge>)}{!task.labels.length && <span className={styles.muted}>Sem rótulos.</span>}</div>
      <Field label="Aplicar rótulos">
        <Select multiple value={selectedLabelIds} onChange={(event) => void run(() => tasksService.update(task.id, { labelIds: [...event.target.selectedOptions].map((option) => option.value) }))}>
          {labels.data?.map((label) => <option key={label.id} value={label.id}>{label.name}</option>)}
        </Select>
      </Field>
      <form className={styles.inlineForm} onSubmit={createLabel}>
        <Field label="Novo rótulo" className={styles.grow}><Input maxLength={60} value={newLabel} onChange={(event) => setNewLabel(event.target.value)} placeholder="Ex.: urgente" /></Field>
        <Button type="submit" disabled={!newLabel.trim()}>Criar</Button>
      </form>
      {Boolean(labels.data?.length) && <div className={styles.chipList}>{labels.data?.map((label) => <span className={styles.chip} key={label.id}>{label.name}<button type="button" aria-label={`Excluir rótulo ${label.name}`} onClick={() => void run(async () => { await tasksService.deleteLabel(label.id); labels.reload(); })}>×</button></span>)}</div>}
    </section>
    <section className={styles.detailPanel}>
      <div className={styles.sectionHeading}><h2>Marco</h2>{task.milestone && <Badge tone="warning">{task.milestone.name}{task.milestone.dueAt ? ` · ${new Date(task.milestone.dueAt).toLocaleDateString("pt-BR")}` : ""}</Badge>}</div>
      <Field label="Marco do pleito">
        <Select value={task.milestoneId ?? ""} onChange={(event) => void run(() => tasksService.update(task.id, { milestoneId: event.target.value || null }))}>
          <option value="">Sem marco</option>
          {milestones.data?.map((milestone) => <option key={milestone.id} value={milestone.id}>{milestone.name}</option>)}
        </Select>
      </Field>
      <form className={styles.inlineForm} onSubmit={createMilestone}>
        <Field label="Novo marco" className={styles.grow}><Input maxLength={140} value={milestoneName} onChange={(event) => setMilestoneName(event.target.value)} placeholder="Ex.: Véspera da eleição" /></Field>
        <Button type="submit" disabled={!milestoneName.trim()}>Criar</Button>
      </form>
    </section>
  </>;
}
