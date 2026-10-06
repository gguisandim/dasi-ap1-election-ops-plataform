import { useState } from "react";
import { Badge, Button, Card, EmptyState, ErrorState, Field, Input, Loading, Select, useAsync } from "@eops/ui";
import { REPORT_GRANULARITIES, type ReportGranularity } from "@eops/shared/reports";
import { ReportNav } from "../components/ReportNav";
import { useHasPermission } from "../hooks/useHasPermission";
import { REPORT_METRICS, metricLabel } from "../metrics";
import { reportsService } from "../../services/reportsService";
import type { ReportFilters, SavedReportView, SavedReportViewInput } from "../../types";
import styles from "../../styles/overview.module.css";

interface ViewForm {
  id?: string;
  name: string;
  description: string;
  filters: ReportFilters;
  metrics: string[];
  granularity: ReportGranularity;
  isDefault: boolean;
  shared: boolean;
}

const EMPTY_FORM: ViewForm = { name: "", description: "", filters: {}, metrics: [], granularity: "day", isDefault: false, shared: false };

function toInput(form: ViewForm): SavedReportViewInput {
  const filters = Object.fromEntries(Object.entries(form.filters).filter(([, value]) => value !== undefined && value !== ""));
  return { name: form.name.trim(), description: form.description.trim() || undefined, filters, metricsJson: form.metrics, granularity: form.granularity, isDefault: form.isDefault, shared: form.shared };
}

export function ReportsViewsPage() {
  const canManage = useHasPermission("reports.manage").allowed;
  const views = useAsync(reportsService.views, []);
  const references = useAsync(reportsService.references, []);
  const [form, setForm] = useState<ViewForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<Error>();

  const reset = () => { setForm(EMPTY_FORM); setError(undefined); };
  const changeFilter = (key: keyof ReportFilters, value: string) => setForm((current) => ({ ...current, filters: { ...current.filters, [key]: value || undefined } }));

  const startEdit = (view: SavedReportView) => {
    setError(undefined);
    const filters = (view.filters ?? {}) as ReportFilters;
    setForm({
      id: view.id,
      name: view.name,
      description: view.description ?? "",
      filters,
      metrics: Array.isArray(view.metricsJson) ? view.metricsJson : [],
      granularity: (view.granularity as ReportGranularity) ?? "day",
      isDefault: view.isDefault,
      shared: view.shared,
    });
  };

  const submit = async () => {
    setSaving(true);
    setError(undefined);
    try {
      if (form.id) await reportsService.updateView(form.id, toInput(form));
      else await reportsService.createView(toInput(form));
      reset();
      views.reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause : new Error("Não foi possível salvar."));
    } finally {
      setSaving(false);
    }
  };

  const act = async (operation: () => Promise<unknown>) => {
    setError(undefined);
    try { await operation(); views.reload(); }
    catch (cause) { setError(cause instanceof Error ? cause : new Error("Operação não concluída.")); }
  };

  return <section className={styles.page}>
    <header className={styles.header}><div><span className={styles.tag}>CONFIGURAÇÃO</span><h1>Visões salvas</h1><p>Filtros e métricas por operador. Visões privadas são visíveis apenas para o dono; compartilhadas exigem <code>reports.manage</code>. Limite de 20 visões por usuário.</p></div></header>
    <ReportNav />
    <div className={styles.grid}>
      <Card>
        <div className={styles.sectionTitle}><h2>Minhas visões e compartilhadas</h2><Button secondary onClick={views.reload}>Atualizar</Button></div>
        {views.loading && <Loading label="Carregando visões…" />}
        {views.error && <ErrorState error={views.error} onRetry={views.reload} />}
        {views.data?.length === 0 && <EmptyState title="Nenhuma visão salva" description="Crie uma visão para fixar filtros e métricas." />}
        {views.data && views.data.length > 0 && <ul className={styles.viewList}>{views.data.map((view) => <li key={view.id} className={styles.viewCard}>
          <div>
            <h3>{view.name} {view.isDefault && <Badge tone="success">padrão</Badge>} {view.shared && <Badge tone="warning">compartilhada</Badge>}</h3>
            <p>{view.description ?? "Sem descrição."}</p>
            <p className={styles.muted}>{view.granularity} · dono {view.owner?.name ?? view.ownerId}{Array.isArray(view.metricsJson) && view.metricsJson.length ? ` · ${view.metricsJson.map(metricLabel).join(", ")}` : ""}</p>
          </div>
          <div className={styles.viewCardActions}>
            {view.editable ? <>
              <Button secondary onClick={() => startEdit(view)}>Editar</Button>
              <Button secondary onClick={() => void act(() => reportsService.updateView(view.id, { isDefault: !view.isDefault }))}>{view.isDefault ? "Remover padrão" : "Definir padrão"}</Button>
              <Button secondary disabled={!canManage && !view.shared} onClick={() => void act(() => reportsService.updateView(view.id, { shared: !view.shared }))}>{view.shared ? "Descompartilhar" : "Compartilhar"}</Button>
              <Button onClick={() => void act(() => reportsService.removeView(view.id))}>Remover</Button>
            </> : <span className={styles.muted}>Somente leitura para o seu perfil.</span>}
          </div>
        </li>)}</ul>}
      </Card>
      <Card>
        <div className={styles.sectionTitle}><h2>{form.id ? "Editar visão" : "Nova visão"}</h2></div>
        {error && <ErrorState error={error} />}
        <div className={styles.form}>
          <Field label="Nome"><Input value={form.name} maxLength={80} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /></Field>
          <Field label="Descrição"><Input value={form.description} maxLength={500} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} /></Field>
          <div className={styles.formGrid}>
            <Field label="De"><Input type="date" value={form.filters.from ?? ""} onChange={(event) => changeFilter("from", event.target.value)} /></Field>
            <Field label="Até"><Input type="date" value={form.filters.to ?? ""} onChange={(event) => changeFilter("to", event.target.value)} /></Field>
            <Field label="Pleito"><Select value={form.filters.electionId ?? ""} onChange={(event) => changeFilter("electionId", event.target.value)}><option value="">Todos</option>{references.data?.elections.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field>
            <Field label="Zona"><Select value={form.filters.electoralZoneId ?? ""} onChange={(event) => changeFilter("electoralZoneId", event.target.value)}><option value="">Todas</option>{references.data?.zones.map((item) => <option key={item.id} value={item.id}>Zona {item.number}</option>)}</Select></Field>
            <Field label="Local"><Select value={form.filters.pollingPlaceId ?? ""} onChange={(event) => changeFilter("pollingPlaceId", event.target.value)}><option value="">Todos</option>{references.data?.places.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field>
            <Field label="Severidade"><Select value={form.filters.severity ?? ""} onChange={(event) => changeFilter("severity", event.target.value)}><option value="">Todas</option>{["CRITICAL", "HIGH", "MEDIUM", "LOW"].map((value) => <option key={value} value={value}>{value}</option>)}</Select></Field>
            <Field label="Status"><Input value={form.filters.status ?? ""} onChange={(event) => changeFilter("status", event.target.value)} /></Field>
            <Field label="Granularidade"><Select value={form.granularity} onChange={(event) => setForm((current) => ({ ...current, granularity: event.target.value as ReportGranularity }))}>{REPORT_GRANULARITIES.map((value) => <option key={value} value={value}>{value}</option>)}</Select></Field>
          </div>
          <Field label="Métricas (Ctrl/Cmd para múltiplas)">
            <select className={styles.multiSelect} multiple size={6} value={form.metrics} onChange={(event) => setForm((current) => ({ ...current, metrics: Array.from(event.target.selectedOptions).map((option) => option.value) }))}>
              {REPORT_METRICS.map((metric) => <option key={metric} value={metric}>{metricLabel(metric)}</option>)}
            </select>
          </Field>
          <label className={styles.checkboxRow}><input type="checkbox" checked={form.isDefault} onChange={(event) => setForm((current) => ({ ...current, isDefault: event.target.checked }))} />Usar como visão padrão</label>
          <label className={styles.checkboxRow}><input type="checkbox" checked={form.shared} disabled={!canManage} onChange={(event) => setForm((current) => ({ ...current, shared: event.target.checked }))} />Compartilhar com a equipe{!canManage && " (requer reports.manage)"}</label>
          <div className={styles.actions}>
            <Button onClick={() => void submit()} disabled={saving || !form.name.trim()}>{saving ? "Salvando…" : form.id ? "Salvar alterações" : "Criar visão"}</Button>
            {form.id && <Button secondary onClick={reset}>Cancelar edição</Button>}
          </div>
        </div>
      </Card>
    </div>
  </section>;
}
