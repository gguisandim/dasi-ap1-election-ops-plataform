import { useState } from "react";
import { Breadcrumb, Button, Card, EmptyState, ErrorState, Input, Loading, useAsync } from "@eops/ui";
import type { IncidentCategorySummary } from "@eops/shared/incidents";
import { incidentService } from "../services/incidentService";
import styles from "../styles/incidents.module.css";

export function IncidentCategoriesPage() {
  const { data, error, loading, reload } = useAsync(incidentService.categories, []);
  const [draft, setDraft] = useState({ key: "", name: "", description: "" });
  const [editing, setEditing] = useState<IncidentCategorySummary | null>(null);
  const [actionError, setActionError] = useState<unknown>();
  async function run(action: () => Promise<unknown>) { setActionError(undefined); try { await action(); setDraft({ key: "", name: "", description: "" }); setEditing(null); reload(); } catch (cause) { setActionError(cause); } }
  return <section className={styles.page}>
    <Breadcrumb items={[{ label: "Incidentes", to: "/incidents" }, { label: "Categorias" }]} />
    <header className={styles.header}><div><span className={styles.eyebrow}>ADMINISTRAÇÃO</span><h1>Categorias de incidentes</h1><p>Organize a classificação sem remover referências históricas.</p></div></header>
    {actionError !== undefined && <ErrorState error={actionError} />}
    <div className={styles.categoryLayout}><Card><h2>{editing ? "Editar categoria" : "Nova categoria"}</h2><form className={styles.actions} onSubmit={(event) => { event.preventDefault(); void run(() => editing ? incidentService.updateCategory(editing.id, { name: draft.name, description: draft.description }) : incidentService.createCategory(draft)); }}>
      {!editing && <Input aria-label="Chave" placeholder="Chave, por exemplo: conectividade" value={draft.key} onChange={(event) => setDraft((current) => ({ ...current, key: event.target.value }))} />}
      <Input aria-label="Nome" placeholder="Nome" value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} />
      <Input aria-label="Descrição" placeholder="Descrição operacional" value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} />
      <div className={styles.formActions}><Button type="submit" disabled={!draft.name.trim() || (!editing && !draft.key.trim())}>Salvar</Button>{editing && <Button secondary type="button" onClick={() => { setEditing(null); setDraft({ key: "", name: "", description: "" }); }}>Cancelar</Button>}</div>
    </form></Card>
    <div>{loading && <Loading />}{error && <ErrorState error={error} onRetry={reload} />}{data?.length === 0 && <EmptyState title="Nenhuma categoria" description="Crie a primeira categoria operacional." />}{data && data.length > 0 && <ul className={styles.categoryList}>{data.map((category) => <li key={category.id}><div><strong>{category.name}</strong><span>{category.key}</span><p>{category.description ?? "Sem descrição"}</p></div><div><span className={category.active ? styles.activeState : styles.inactiveState}>{category.active ? "Ativa" : "Inativa"}</span><Button secondary onClick={() => { setEditing(category); setDraft({ key: category.key, name: category.name, description: category.description ?? "" }); }}>Editar</Button><Button secondary onClick={() => void run(() => incidentService.updateCategory(category.id, { active: !category.active }))}>{category.active ? "Desativar" : "Ativar"}</Button></div></li>)}</ul>}</div></div>
  </section>;
}
