import { Button, ErrorState, Loading, Select, useAsync } from "@eops/ui";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { HandoverInput } from "../../types";
import { HandoverNav } from "../components/HandoverNav";
import { shiftHandoversService } from "../services/shiftHandoversService";
import styles from "../styles/shift-handovers.module.css";

const toggle = (items: string[], id: string) => items.includes(id) ? items.filter((item) => item !== id) : [...items, id];

export function HandoverFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const shifts = useAsync(shiftHandoversService.shifts, []);
  const existing = useAsync(() => id ? shiftHandoversService.detail(id) : Promise.resolve(undefined), [id]);
  const [shiftId, setShiftId] = useState("");
  const context = useAsync(() => shiftId ? shiftHandoversService.context(shiftId) : Promise.resolve(undefined), [shiftId]);
  const [recipientUserId, setRecipient] = useState("");
  const [summary, setSummary] = useState("");
  const [pendingNotes, setPendingNotes] = useState("");
  const [observations, setObservations] = useState("");
  const [incidentIds, setIncidentIds] = useState<string[]>([]);
  const [taskIds, setTaskIds] = useState<string[]>([]);
  const [assetIds, setAssetIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<Error>();
  useEffect(() => { const item = existing.data; if (!item) return; setShiftId(item.shiftId); setRecipient(item.recipientUserId); setSummary(item.summary); setPendingNotes(item.pendingNotes ?? ''); setObservations(item.observations ?? ''); setIncidentIds(item.incidents.map((x) => x.incident.id)); setTaskIds(item.tasks.map((x) => x.task.id)); setAssetIds(item.assets.map((x) => x.asset.id)); }, [existing.data]);
  const input = useMemo<HandoverInput>(() => ({ shiftId, recipientUserId, summary, pendingNotes, observations, incidentIds, taskIds, assetIds }), [shiftId, recipientUserId, summary, pendingNotes, observations, incidentIds, taskIds, assetIds]);
  async function save(event: FormEvent) { event.preventDefault(); setSaving(true); setError(undefined); try { const item = id ? await shiftHandoversService.update(id, input) : await shiftHandoversService.create(input); navigate(`/shift-handovers/${item.id}`); } catch (reason) { setError(reason instanceof Error ? reason : new Error('Não foi possível salvar.')); } finally { setSaving(false); } }
  if (existing.loading || shifts.loading) return <Loading />;
  if (existing.error || shifts.error) return <ErrorState error={existing.error ?? shifts.error} />;
  return <section className={styles.page}><HandoverNav /><header className={styles.header}><div><span>Operações · Preparação</span><h1>{id ? 'Editar passagem' : 'Nova passagem'}</h1><p>Registre o contexto essencial; sugestões só entram quando selecionadas.</p></div></header>
    {error && <ErrorState error={error} />}
    <form className={`${styles.panel} ${styles.form}`} onSubmit={save}>
      <div className={styles.formGrid}>
        <label className={styles.field}>Turno<Select required disabled={Boolean(id)} value={shiftId} onChange={(e) => setShiftId(e.target.value)}><option value="">Selecione</option>{shifts.data?.map((item) => <option key={item.id} value={item.id}>{item.name ?? 'Turno'} · {item.team.name} · {item.status}</option>)}</Select></label>
        <label className={styles.field}>Destinatário<Select required value={recipientUserId} onChange={(e) => setRecipient(e.target.value)}><option value="">Selecione</option>{context.data?.recipients.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.email}</option>)}</Select></label>
        <label className={`${styles.field} ${styles.wide}`}>Resumo<textarea value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Situação do turno, riscos e próximos passos" /></label>
        <label className={styles.field}>Pendências<textarea value={pendingNotes} onChange={(e) => setPendingNotes(e.target.value)} /></label>
        <label className={styles.field}>Observações<textarea value={observations} onChange={(e) => setObservations(e.target.value)} /></label>
      </div>
      {context.loading && <Loading label="Carregando contexto do turno…" />}{context.error && <ErrorState error={context.error} onRetry={context.reload} />}
      {context.data && <>
        <ReferenceGroup title="Incidentes sugeridos" items={context.data.incidents.map((x) => ({ id: x.id, title: `${x.code} · ${x.title}`, detail: `${x.severity} · ${x.status}` }))} selected={incidentIds} onToggle={(value) => setIncidentIds(toggle(incidentIds, value))} />
        <ReferenceGroup title="Tarefas sugeridas" items={context.data.tasks.map((x) => ({ id: x.id, title: x.title, detail: `${x.priority} · ${x.status}` }))} selected={taskIds} onToggle={(value) => setTaskIds(toggle(taskIds, value))} />
        <ReferenceGroup title="Ativos em atenção" items={context.data.assets.map((x) => ({ id: x.id, title: `${x.assetTag} · ${x.name}`, detail: `${x.status} · ${x.condition}` }))} selected={assetIds} onToggle={(value) => setAssetIds(toggle(assetIds, value))} />
      </>}
      <div className={styles.actions}><Button type="submit" disabled={saving || !shiftId || !recipientUserId}>{saving ? 'Salvando…' : 'Salvar rascunho'}</Button><Button secondary type="button" onClick={() => navigate(-1)}>Cancelar</Button></div>
    </form>
  </section>;
}

function ReferenceGroup({ title, items, selected, onToggle }: { title: string; items: Array<{ id: string; title: string; detail: string }>; selected: string[]; onToggle: (id: string) => void }) {
  return <section><h2>{title}</h2>{!items.length ? <p>Nenhuma sugestão disponível.</p> : <div className={styles.choiceGrid}>{items.map((item) => <label className={styles.choice} key={item.id}><input type="checkbox" checked={selected.includes(item.id)} onChange={() => onToggle(item.id)} /><span>{item.title}<small>{item.detail}</small></span></label>)}</div>}</section>;
}
