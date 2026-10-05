import { useEffect, useState, type FormEvent } from "react";
import { Badge, Button, Card, ErrorState, Field, Input, Loading, Select, useAsync } from "@eops/ui";
import type { IncidentSeverity } from "@eops/shared/incidents";
import { useNavigate, useParams } from "react-router-dom";
import { SCENARIO_EVENT_TYPES, SCENARIO_EVENT_TYPE_LABELS, SEVERITY_LABELS, TARGETS_BY_TYPE, TARGET_TYPE_LABELS, simulatorService, type ScenarioEventInput, type SimulationScenarioEventType, type SimulationTargetType } from "../services/simulatorService";
import styles from "../styles/simulator.module.css";

interface EventDraft { offsetSeconds: number; type: SimulationScenarioEventType; severity: IncidentSeverity | ""; targetType: SimulationTargetType; targetId: string; probability: number; }
const emptyDraft = (): EventDraft => ({ offsetSeconds: 60, type: "INCIDENT_CREATE", severity: "MEDIUM", targetType: "POLLING_PLACE", targetId: "", probability: 100 });
const severities: IncidentSeverity[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

function normalize(draft: EventDraft): ScenarioEventInput {
  const targets = TARGETS_BY_TYPE[draft.type];
  const targetType = targets.includes(draft.targetType) ? draft.targetType : targets[0];
  return { offsetSeconds: draft.offsetSeconds, type: draft.type, severity: draft.severity || undefined, targetType, targetId: draft.targetId || undefined, probability: draft.probability };
}

function EventFields({ value, onChange }: { value: EventDraft; onChange: (next: EventDraft) => void }) {
  const targets = TARGETS_BY_TYPE[value.type];
  return <div className={styles.eventFields}>
    <Field label="Offset (s)"><Input type="number" min={0} required value={value.offsetSeconds} onChange={(event) => onChange({ ...value, offsetSeconds: Number(event.target.value) })} /></Field>
    <Field label="Tipo"><Select value={value.type} onChange={(event) => { const type = event.target.value as SimulationScenarioEventType; onChange({ ...value, type, targetType: TARGETS_BY_TYPE[type][0] }); }}>{SCENARIO_EVENT_TYPES.map((type) => <option key={type} value={type}>{SCENARIO_EVENT_TYPE_LABELS[type]}</option>)}</Select></Field>
    <Field label="Alvo"><Select value={targets.includes(value.targetType) ? value.targetType : targets[0]} onChange={(event) => onChange({ ...value, targetType: event.target.value as SimulationTargetType })}>{targets.map((target) => <option key={target} value={target}>{TARGET_TYPE_LABELS[target]}</option>)}</Select></Field>
    <Field label="ID do alvo"><Input value={value.targetId} onChange={(event) => onChange({ ...value, targetId: event.target.value })} placeholder="Identificador do alvo" /></Field>
    {value.type === "INCIDENT_CREATE" && <Field label="Severidade"><Select value={value.severity} onChange={(event) => onChange({ ...value, severity: event.target.value as IncidentSeverity | "" })}><option value="">Sem severidade</option>{severities.map((severity) => <option key={severity} value={severity}>{SEVERITY_LABELS[severity]}</option>)}</Select></Field>}
    <Field label="Probabilidade (%)"><Input type="number" min={0} max={100} required value={value.probability} onChange={(event) => onChange({ ...value, probability: Number(event.target.value) })} /></Field>
  </div>;
}

export function ScenarioBuilderPage() {
  const { id } = useParams(); const editing = Boolean(id); const navigate = useNavigate();
  const scenario = useAsync(() => (id ? simulatorService.scenario(id) : Promise.resolve(undefined)), [id]);
  const [name, setName] = useState(""); const [description, setDescription] = useState(""); const [seed, setSeed] = useState(""); const [durationSeconds, setDurationSeconds] = useState("");
  const [drafts, setDrafts] = useState<EventDraft[]>([emptyDraft()]); const [newEvent, setNewEvent] = useState<EventDraft>(emptyDraft()); const [error, setError] = useState<unknown>(); const [busy, setBusy] = useState(false);
  useEffect(() => { if (!scenario.data) return; setName(scenario.data.name); setDescription(scenario.data.description ?? ""); setSeed(scenario.data.seed === null ? "" : String(scenario.data.seed)); setDurationSeconds(scenario.data.durationSeconds === null ? "" : String(scenario.data.durationSeconds)); }, [scenario.data]);

  async function run(operation: () => Promise<unknown>, after?: () => void) { setBusy(true); setError(undefined); try { await operation(); after?.(); } catch (cause) { setError(cause); } finally { setBusy(false); } }
  function scenarioFields() { return { name, description: description || undefined, seed: seed === "" ? undefined : Number(seed), durationSeconds: durationSeconds === "" ? undefined : Number(durationSeconds) }; }
  function submit(event: FormEvent) { event.preventDefault(); if (editing && id) void run(() => simulatorService.updateScenario(id, scenarioFields()), () => scenario.reload()); else void run(() => simulatorService.createScenario({ ...scenarioFields(), configuration: {}, events: drafts.map(normalize) }), () => navigate("/simulator/scenarios")); }
  function addEvent() { if (editing && id) void run(() => simulatorService.addScenarioEvent(id, normalize(newEvent)), () => { setNewEvent(emptyDraft()); scenario.reload(); }); else setDrafts((current) => [...current, emptyDraft()]); }
  function removeEvent() { if (drafts.length > 1) setDrafts((current) => current.slice(0, -1)); }

  if (editing && scenario.loading) return <Loading />;
  if (editing && scenario.error) return <ErrorState error={scenario.error} onRetry={scenario.reload} />;
  if (editing && !scenario.data) return <ErrorState error={new Error("Cenário não encontrado.")} />;

  return <section className={styles.page}><header><span>SIMULAÇÃO</span><h1>{editing ? "Editar cenário" : "Novo cenário"}</h1><p>Deslocamento, tipo, alvo, severidade e probabilidade de cada evento programado.</p></header>{error !== undefined && <ErrorState error={error} />}<div className={styles.grid}>
    <Card><h2>Dados do cenário</h2><form onSubmit={submit}>
      <Field label="Nome"><Input required minLength={3} maxLength={160} value={name} onChange={(event) => setName(event.target.value)} /></Field>
      <Field label="Descrição"><Input maxLength={600} value={description} onChange={(event) => setDescription(event.target.value)} /></Field>
      <Field label="Seed (determinismo)"><Input type="number" min={0} value={seed} onChange={(event) => setSeed(event.target.value)} placeholder="Opcional" /></Field>
      <Field label="Duração (s)"><Input type="number" min={0} value={durationSeconds} onChange={(event) => setDurationSeconds(event.target.value)} placeholder="Opcional" /></Field>
      {!editing && <div className={styles.eventList}>{drafts.map((draft, index) => <div className={styles.eventRow} key={index}><span className={styles.eventIndex}>Evento {index + 1}</span><EventFields value={draft} onChange={(next) => setDrafts((current) => current.map((entry, entryIndex) => (entryIndex === index ? next : entry)))} /></div>)}<div className={styles.formActions}><Button type="button" secondary onClick={addEvent} disabled={busy}>Adicionar evento</Button><Button type="button" secondary onClick={removeEvent} disabled={busy || drafts.length <= 1}>Remover último</Button></div></div>}
      <div className={styles.formActions}><Button type="submit" disabled={busy}>{editing ? "Salvar cenário" : "Criar cenário"}</Button>{editing && <Button type="button" secondary disabled={busy} onClick={() => id && void run(() => simulatorService.deleteScenario(id), () => navigate("/simulator/scenarios"))}>Excluir cenário</Button>}</div>
    </form></Card>
    <Card><h2>Eventos programados</h2>{editing ? <ul className={styles.events}>{scenario.data?.events.map((event) => <li key={event.id}><div><strong>{SCENARIO_EVENT_TYPE_LABELS[event.type]}</strong><span>{event.offsetSeconds}s · {TARGET_TYPE_LABELS[event.targetType]}{event.targetId ? ` (${event.targetId})` : ""} · {event.probability}%</span></div>{event.severity && <Badge tone={event.severity === "CRITICAL" ? "danger" : event.severity === "HIGH" ? "warning" : "neutral"}>{SEVERITY_LABELS[event.severity]}</Badge>}<div className={styles.eventActions}><Button secondary disabled={busy} onClick={() => id && void run(() => simulatorService.duplicateScenarioEvent(id, event.id), () => scenario.reload())}>Duplicar</Button><Button secondary disabled={busy} onClick={() => id && void run(() => simulatorService.deleteScenarioEvent(id, event.id), () => scenario.reload())}>Remover</Button></div></li>)}</ul> : <p className={styles.hint}>Salve o cenário para gerenciar os eventos individualmente. Enquanto isso, use a lista ao lado.</p>}{editing && <><h3>Adicionar evento</h3><EventFields value={newEvent} onChange={setNewEvent} /><div className={styles.formActions}><Button type="button" disabled={busy} onClick={addEvent}>Adicionar evento</Button></div></>}{!editing && scenario.data === undefined && <p className={styles.hint}>Os eventos informados no formulário serão criados junto com o cenário.</p>}</Card>
  </div></section>;
}
