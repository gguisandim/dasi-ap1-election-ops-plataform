import { Badge, Button, EmptyState, ErrorState, Field, Input, Loading, Select, useAsync } from "@eops/ui";
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import type { BulkTaskUpdate, TaskFilters, TaskPriority, TaskSavedFilter, TaskStatus } from "../../types";
import { TasksNav } from "../components/TasksNav";
import { useHasPermission } from "../hooks/usePermissions";
import { tasksService } from "../services/tasksService";
import { isTaskOverdue, TASK_PRIORITIES, TASK_PRIORITY_LABELS, TASK_STATUSES, TASK_STATUS_LABELS } from "../status";
import styles from "../styles/tasks.module.css";

type FilterForm = {
  electionId: string; electoralZoneId: string; pollingPlaceId: string; assigneeId: string;
  status: string; priority: string; labelId: string; milestoneId: string; overdue: string; search: string;
};
const emptyFilters: FilterForm = { electionId: "", electoralZoneId: "", pollingPlaceId: "", assigneeId: "", status: "", priority: "", labelId: "", milestoneId: "", overdue: "", search: "" };

function toQuery(filters: FilterForm): TaskFilters {
  return {
    electionId: filters.electionId || undefined,
    electoralZoneId: filters.electoralZoneId || undefined,
    pollingPlaceId: filters.pollingPlaceId || undefined,
    assigneeId: filters.assigneeId || undefined,
    status: (filters.status || undefined) as TaskStatus | undefined,
    priority: (filters.priority || undefined) as TaskPriority | undefined,
    labelId: filters.labelId || undefined,
    milestoneId: filters.milestoneId || undefined,
    overdue: filters.overdue === "" ? undefined : filters.overdue === "true",
    search: filters.search || undefined,
  };
}

function fromSaved(filters: TaskFilters): FilterForm {
  return {
    electionId: filters.electionId ?? "", electoralZoneId: filters.electoralZoneId ?? "", pollingPlaceId: filters.pollingPlaceId ?? "",
    assigneeId: filters.assigneeId ?? "", status: filters.status ?? "", priority: filters.priority ?? "", labelId: filters.labelId ?? "",
    milestoneId: filters.milestoneId ?? "", overdue: filters.overdue === undefined ? "" : String(filters.overdue), search: filters.search ?? "",
  };
}

export function TasksListPage() {
  const [filters, setFilters] = useState<FilterForm>(emptyFilters);
  const [selection, setSelection] = useState<string[]>([]);
  const [filterName, setFilterName] = useState("");
  const [bulk, setBulk] = useState({ status: "", priority: "", assigneeId: "", addLabelId: "", removeLabelId: "" });
  const [error, setError] = useState<Error>();
  const references = useAsync(tasksService.references, []);
  const labels = useAsync(tasksService.labels, []);
  const milestones = useAsync(() => tasksService.milestones(filters.electionId || undefined), [filters.electionId]);
  const savedFilters = useAsync(tasksService.savedFilters, []);
  const tasks = useAsync(() => tasksService.tasks(toQuery(filters)), [filters]);
  const { allowed: canManage } = useHasPermission("tasks.manage");
  const zones = references.data?.zones.filter((item) => !filters.electionId || item.electionId === filters.electionId) ?? [];
  const places = references.data?.places.filter((item) => !filters.electoralZoneId || item.electoralZoneId === filters.electoralZoneId) ?? [];
  const visibleIds = tasks.data?.map((task) => task.id) ?? [];
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selection.includes(id));

  function update<K extends keyof FilterForm>(key: K, value: string) { setFilters((old) => ({ ...old, [key]: value })); }
  function toggle(id: string) { setSelection((old) => (old.includes(id) ? old.filter((item) => item !== id) : [...old, id])); }

  async function run(action: () => Promise<unknown>) {
    setError(undefined);
    try { await action(); tasks.reload(); }
    catch (reason) { setError(reason instanceof Error ? reason : new Error("A operação não foi concluída.")); }
  }

  async function saveFilter(event: FormEvent) {
    event.preventDefault();
    const name = filterName.trim();
    if (!name) return;
    await run(async () => { await tasksService.createSavedFilter(name, toQuery(filters)); setFilterName(""); savedFilters.reload(); });
  }

  async function applyBulk(event: FormEvent) {
    event.preventDefault();
    const input: BulkTaskUpdate = { ids: selection };
    if (bulk.status) input.status = bulk.status as TaskStatus;
    if (bulk.priority) input.priority = bulk.priority as TaskPriority;
    if (bulk.assigneeId) input.assigneeId = bulk.assigneeId;
    if (bulk.addLabelId) input.addLabelIds = [bulk.addLabelId];
    if (bulk.removeLabelId) input.removeLabelIds = [bulk.removeLabelId];
    await run(async () => { await tasksService.bulkUpdate(input); setSelection([]); setBulk({ status: "", priority: "", assigneeId: "", addLabelId: "", removeLabelId: "" }); });
  }

  function applySaved(saved: TaskSavedFilter) { setFilters(fromSaved(saved.filters)); setSelection([]); }

  return <section className={styles.page}>
    <TasksNav />
    <header className={styles.header}><div><span>CONSULTA E FILTROS</span><h1>Todas as tarefas</h1><p>Compare prazos, responsáveis, prioridade e situação.</p></div></header>
    <section className={styles.detailPanel}>
      <div className={styles.filters}>
        <label>Pleito<Select value={filters.electionId} onChange={(event) => { update("electionId", event.target.value); update("electoralZoneId", ""); update("pollingPlaceId", ""); }}><option value="">Todos</option>{references.data?.elections.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></label>
        <label>Zona<Select value={filters.electoralZoneId} onChange={(event) => { update("electoralZoneId", event.target.value); update("pollingPlaceId", ""); }}><option value="">Todas</option>{zones.map((item) => <option key={item.id} value={item.id}>Zona {item.number} · {item.name}</option>)}</Select></label>
        <label>Local<Select value={filters.pollingPlaceId} onChange={(event) => update("pollingPlaceId", event.target.value)}><option value="">Todos</option>{places.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></label>
        <label>Responsável<Select value={filters.assigneeId} onChange={(event) => update("assigneeId", event.target.value)}><option value="">Todos</option>{references.data?.users.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></label>
        <label>Status<Select value={filters.status} onChange={(event) => update("status", event.target.value)}><option value="">Todos</option>{TASK_STATUSES.map((status) => <option key={status} value={status}>{TASK_STATUS_LABELS[status]}</option>)}</Select></label>
        <label>Prioridade<Select value={filters.priority} onChange={(event) => update("priority", event.target.value)}><option value="">Todas</option>{TASK_PRIORITIES.map((priority) => <option key={priority} value={priority}>{TASK_PRIORITY_LABELS[priority]}</option>)}</Select></label>
        <label>Rótulo<Select value={filters.labelId} onChange={(event) => update("labelId", event.target.value)}><option value="">Todos</option>{labels.data?.map((label) => <option key={label.id} value={label.id}>{label.name}</option>)}</Select></label>
        <label>Marco<Select value={filters.milestoneId} onChange={(event) => update("milestoneId", event.target.value)}><option value="">Todos</option>{milestones.data?.map((milestone) => <option key={milestone.id} value={milestone.id}>{milestone.name}</option>)}</Select></label>
        <label>Prazo<Select value={filters.overdue} onChange={(event) => update("overdue", event.target.value)}><option value="">Qualquer prazo</option><option value="true">Atrasadas</option><option value="false">No prazo</option></Select></label>
        <label>Buscar<Input value={filters.search} onChange={(event) => update("search", event.target.value)} placeholder="Título ou descrição" /></label>
      </div>
    </section>
    <section className={styles.detailPanel}>
      <div className={styles.sectionHeading}><h2>Filtros salvos</h2><Badge>{savedFilters.data?.length ?? 0}</Badge></div>
      {error && <p className={styles.inlineError}>{error.message}</p>}
      {savedFilters.data?.length ? <div className={styles.chipList}>{savedFilters.data.map((saved) => <span className={styles.chip} key={saved.id}><button type="button" className={styles.chipLabel} onClick={() => applySaved(saved)}>{saved.name}</button><button type="button" aria-label={`Excluir filtro ${saved.name}`} onClick={() => void run(async () => { await tasksService.deleteSavedFilter(saved.id); savedFilters.reload(); })}>×</button></span>)}</div> : <p className={styles.muted}>Nenhum filtro salvo. Ajuste os filtros e salve para reutilizar.</p>}
      <form className={styles.inlineForm} onSubmit={saveFilter}>
        <Field label="Salvar filtros atuais" className={styles.grow}><Input maxLength={80} value={filterName} onChange={(event) => setFilterName(event.target.value)} placeholder="Nome do filtro" /></Field>
        <Button type="submit" disabled={!filterName.trim()}>Salvar</Button>
      </form>
    </section>
    {canManage && selection.length > 0 && <section className={styles.detailPanel}>
      <div className={styles.sectionHeading}><h2>Ações em lote</h2><Badge tone="warning">{selection.length} selecionada(s)</Badge></div>
      <form className={styles.filters} onSubmit={applyBulk}>
        <label>Status<Select value={bulk.status} onChange={(event) => setBulk((old) => ({ ...old, status: event.target.value }))}><option value="">Manter</option>{TASK_STATUSES.map((status) => <option key={status} value={status}>{TASK_STATUS_LABELS[status]}</option>)}</Select></label>
        <label>Prioridade<Select value={bulk.priority} onChange={(event) => setBulk((old) => ({ ...old, priority: event.target.value }))}><option value="">Manter</option>{TASK_PRIORITIES.map((priority) => <option key={priority} value={priority}>{TASK_PRIORITY_LABELS[priority]}</option>)}</Select></label>
        <label>Responsável<Select value={bulk.assigneeId} onChange={(event) => setBulk((old) => ({ ...old, assigneeId: event.target.value }))}><option value="">Manter</option>{references.data?.users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</Select></label>
        <label>Adicionar rótulo<Select value={bulk.addLabelId} onChange={(event) => setBulk((old) => ({ ...old, addLabelId: event.target.value }))}><option value="">Nenhum</option>{labels.data?.map((label) => <option key={label.id} value={label.id}>{label.name}</option>)}</Select></label>
        <label>Remover rótulo<Select value={bulk.removeLabelId} onChange={(event) => setBulk((old) => ({ ...old, removeLabelId: event.target.value }))}><option value="">Nenhum</option>{labels.data?.map((label) => <option key={label.id} value={label.id}>{label.name}</option>)}</Select></label>
        <div className={styles.formActions}><Button type="submit">Aplicar em lote</Button><Button type="button" secondary onClick={() => setSelection([])}>Limpar seleção</Button></div>
      </form>
    </section>}
    {tasks.loading && <Loading />}
    {tasks.error && <ErrorState error={tasks.error} onRetry={tasks.reload} />}
    {tasks.data && (tasks.data.length ? <div className={styles.tableWrap}><table className={styles.table}><thead><tr>
      {canManage && <th className={styles.checkColumn}><input type="checkbox" aria-label="Selecionar todas" checked={allSelected} onChange={(event) => setSelection(event.target.checked ? visibleIds : [])} /></th>}
      <th>Tarefa</th><th>Pleito / local</th><th>Rótulos</th><th>Responsável</th><th>Prioridade</th><th>Status</th><th>Prazo</th>
    </tr></thead><tbody>{tasks.data.map((task) => <tr key={task.id}>
      {canManage && <td className={styles.checkColumn}><input type="checkbox" aria-label={`Selecionar ${task.title}`} checked={selection.includes(task.id)} onChange={() => toggle(task.id)} /></td>}
      <td><Link to={`/tasks/${task.id}`}>{task.title}</Link>{task.blockedByDependencies && <small>Bloqueada por dependências</small>}{task.subtasks.length > 0 && <small>{task.subtasks.length} subtarefa(s)</small>}</td>
      <td>{task.election.name}<small>{task.pollingPlace?.name ?? (task.electoralZone ? `Zona ${task.electoralZone.number}` : "Geral")}</small>{task.milestone && <small>Marco: {task.milestone.name}</small>}</td>
      <td><div className={styles.chipList}>{task.labels.map((item) => <span className={styles.chipStatic} key={item.label.id}>{item.label.name}</span>)}{!task.labels.length && "—"}</div></td>
      <td>{task.assignee?.name ?? "Sem responsável"}</td>
      <td><Badge tone={task.priority === "CRITICAL" ? "danger" : task.priority === "HIGH" ? "warning" : "neutral"}>{TASK_PRIORITY_LABELS[task.priority]}</Badge></td>
      <td>{task.blockedByDependencies ? TASK_STATUS_LABELS.BLOCKED : TASK_STATUS_LABELS[task.status]}</td>
      <td className={isTaskOverdue(task) ? styles.overdue : ""}>{task.dueAt ? new Date(task.dueAt).toLocaleDateString("pt-BR") : "Sem prazo"}{isTaskOverdue(task) && <small>Atrasada</small>}</td>
    </tr>)}</tbody></table></div> : <EmptyState title="Nenhuma tarefa encontrada" description="Ajuste os filtros ou crie uma tarefa para este pleito." />)}
  </section>;
}
