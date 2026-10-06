import { useEffect, useState, type FormEvent } from "react";
import { Badge, Button, Card, ErrorState, Field, Input, Loading, Select, useAsync } from "@eops/ui";
import { INCIDENT_SEVERITY_LABELS, type IncidentSeverity } from "@eops/shared/incidents";
import type { ElectionSummary } from "@eops/shared/elections";
import {
  DEFAULT_SIMULATION_WEIGHTS,
  SCENARIO_STATUS_LABELS,
  SIMULATION_DIMENSION_LABELS,
  SIMULATION_DIMENSIONS,
  SIMULATION_EVENT_METADATA,
  SIMULATION_EVENT_TYPE_LABELS,
  SIMULATION_EVENT_TYPES,
  SIMULATION_SPEEDS,
  type SimulationDimension,
  type SimulationEventType,
  type SimulationTargetType,
} from "@eops/shared/simulation";
import { useNavigate, useParams } from "react-router-dom";
import { FAILURE_PROBABILITY_LABELS, SEVERITY_ORDER, simulatorService, type ScenarioCriterionInput, type ScenarioEventInput, type ScenarioObjectiveInput } from "../services/simulatorService";
import styles from "../styles/simulator.module.css";

interface EventDraft { offsetSeconds: number; type: SimulationEventType; severity: IncidentSeverity | ""; targetType: SimulationTargetType; targetId: string; probability: number; enabled: boolean; impact: string; }
interface ObjectiveDraft { key: SimulationDimension; label: string; target: number; direction: "AT_LEAST" | "AT_MOST"; weight: number; }
interface CriterionDraft { metric: SimulationDimension; operator: "GTE" | "LTE"; value: number; label: string; }

const emptyDraft = (): EventDraft => ({ offsetSeconds: 60, type: "INCIDENT_CREATE", severity: "MEDIUM", targetType: "POLLING_PLACE", targetId: "", probability: 100, enabled: true, impact: "" });
const emptyObjective = (): ObjectiveDraft => ({ key: "responseTime", label: "", target: 70, direction: "AT_LEAST", weight: 1 });
const emptyCriterion = (): CriterionDraft => ({ metric: "unresolvedIncidents", operator: "LTE", value: 0, label: "" });

function targetOptions(type: SimulationEventType): SimulationTargetType[] {
  const metadata = SIMULATION_EVENT_METADATA[type];
  return metadata.requiresTarget ? [...metadata.targetTypes] : ["NONE", ...metadata.targetTypes];
}

function normalize(draft: EventDraft): ScenarioEventInput {
  const options = targetOptions(draft.type);
  const targetType = options.includes(draft.targetType) ? draft.targetType : options[0];
  return { offsetSeconds: draft.offsetSeconds, type: draft.type, severity: draft.severity || undefined, targetType, targetId: draft.targetId || undefined, probability: draft.probability, enabled: draft.enabled, impact: draft.impact || undefined };
}

function EventFields({ value, onChange }: { value: EventDraft; onChange: (next: EventDraft) => void }) {
  const metadata = SIMULATION_EVENT_METADATA[value.type];
  const options = targetOptions(value.type);
  return <div className={styles.eventFields}>
    <Field label="Offset (s)"><Input type="number" min={0} required value={value.offsetSeconds} onChange={(event) => onChange({ ...value, offsetSeconds: Number(event.target.value) })} /></Field>
    <Field label="Tipo"><Select value={value.type} onChange={(event) => { const type = event.target.value as SimulationEventType; onChange({ ...value, type, targetType: targetOptions(type)[0] }); }}>{SIMULATION_EVENT_TYPES.map((type) => <option key={type} value={type}>{SIMULATION_EVENT_TYPE_LABELS[type]}</option>)}</Select></Field>
    <Field label="Alvo"><Select value={options.includes(value.targetType) ? value.targetType : options[0]} onChange={(event) => onChange({ ...value, targetType: event.target.value as SimulationTargetType })}>{options.map((target) => <option key={target} value={target}>{target === "NONE" ? "Sem alvo" : target}</option>)}</Select></Field>
    <Field label="ID do alvo" error={metadata.requiresTarget && !value.targetId ? "obrigatório para este tipo" : undefined}><Input value={value.targetId} onChange={(event) => onChange({ ...value, targetId: event.target.value })} placeholder="Identificador do alvo" /></Field>
    <Field label="Severidade"><Select value={value.severity} onChange={(event) => onChange({ ...value, severity: event.target.value as IncidentSeverity | "" })}><option value="">Sem severidade</option>{SEVERITY_ORDER.map((severity) => <option key={severity} value={severity}>{INCIDENT_SEVERITY_LABELS[severity]}</option>)}</Select></Field>
    <Field label="Probabilidade (%)"><Input type="number" min={0} max={100} required value={value.probability} onChange={(event) => onChange({ ...value, probability: Number(event.target.value) })} /></Field>
    <Field label="Impacto esperado"><Input maxLength={300} value={value.impact} onChange={(event) => onChange({ ...value, impact: event.target.value })} placeholder="Opcional" /></Field>
  </div>;
}

export function ScenarioBuilderPage() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const scenario = useAsync(() => (id ? simulatorService.scenario(id) : Promise.resolve(undefined)), [id]);
  const [elections, setElections] = useState<ElectionSummary[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [seed, setSeed] = useState("");
  const [durationSeconds, setDurationSeconds] = useState("");
  const [speed, setSpeed] = useState(1);
  const [isTemplate, setIsTemplate] = useState(false);
  const [electionId, setElectionId] = useState("");
  const [objectives, setObjectives] = useState<ObjectiveDraft[]>([]);
  const [successCriteria, setSuccessCriteria] = useState<CriterionDraft[]>([]);
  const [failureCriteria, setFailureCriteria] = useState<CriterionDraft[]>([]);
  const [weights, setWeights] = useState<Partial<Record<SimulationDimension, number>>>({});
  const [drafts, setDrafts] = useState<EventDraft[]>([emptyDraft()]);
  const [newEvent, setNewEvent] = useState<EventDraft>(emptyDraft());
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);

  useEffect(() => { void simulatorService.elections().then(setElections).catch(() => setElections([])); }, []);
  useEffect(() => {
    if (!scenario.data) return;
    setName(scenario.data.name); setDescription(scenario.data.description ?? ""); setSeed(scenario.data.seed === null ? "" : String(scenario.data.seed));
    setDurationSeconds(scenario.data.durationSeconds === null ? "" : String(scenario.data.durationSeconds)); setSpeed(scenario.data.speed); setIsTemplate(scenario.data.isTemplate); setElectionId(scenario.data.electionId ?? "");
    setObjectives(scenario.data.objectives ?? []); setSuccessCriteria(scenario.data.successCriteria ?? []); setFailureCriteria(scenario.data.failureCriteria ?? []); setWeights(scenario.data.scoreWeights ?? {});
  }, [scenario.data]);

  async function run(operation: () => Promise<unknown>, after?: () => void) { setBusy(true); setError(undefined); try { await operation(); after?.(); } catch (cause) { setError(cause); } finally { setBusy(false); } }
  function scenarioFields() {
    const cleanWeights = Object.fromEntries(Object.entries(weights).filter(([, value]) => typeof value === "number" && value >= 0));
    return { name, description: description || undefined, seed: seed === "" ? undefined : Number(seed), durationSeconds: durationSeconds === "" ? undefined : Number(durationSeconds), speed, isTemplate, electionId: electionId || undefined, objectives: objectives as ScenarioObjectiveInput[], successCriteria: successCriteria as ScenarioCriterionInput[], failureCriteria: failureCriteria as ScenarioCriterionInput[], scoreWeights: Object.keys(cleanWeights).length === 0 ? undefined : cleanWeights };
  }
  function submit(event: FormEvent) { event.preventDefault(); if (editing && id) void run(() => simulatorService.updateScenario(id, scenarioFields()), () => scenario.reload()); else void run(() => simulatorService.createScenario({ ...scenarioFields(), configuration: {}, events: drafts.map(normalize) }), () => navigate("/simulator/scenarios")); }
  function addEvent() { if (editing && id) void run(() => simulatorService.addScenarioEvent(id, normalize(newEvent)), () => { setNewEvent(emptyDraft()); scenario.reload(); }); else setDrafts((current) => [...current, emptyDraft()]); }

  if (editing && scenario.loading) return <Loading />;
  if (editing && scenario.error) return <ErrorState error={scenario.error} onRetry={scenario.reload} />;
  if (editing && !scenario.data) return <ErrorState error={new Error("Cenário não encontrado.")} />;

  return (
    <section className={styles.page}>
      <header><span>SIMULAÇÃO</span><h1>{editing ? "Editar cenário" : "Novo cenário"}</h1><p>Deslocamento, tipo, alvo, severidade, probabilidade e impacto de cada evento programado.</p></header>
      {error !== undefined && <ErrorState error={error} />}
      <div className={styles.grid}>
        <Card>
          <h2>Dados do cenário</h2>
          {editing && scenario.data && <p className={styles.hint}>Situação: <Badge tone={scenario.data.status === "PUBLISHED" ? "success" : scenario.data.status === "ARCHIVED" ? "neutral" : "warning"}>{SCENARIO_STATUS_LABELS[scenario.data.status]}</Badge> · versão {scenario.data.version}</p>}
          <form onSubmit={submit}>
            <Field label="Nome"><Input required minLength={3} maxLength={160} value={name} onChange={(event) => setName(event.target.value)} /></Field>
            <Field label="Descrição"><Input maxLength={600} value={description} onChange={(event) => setDescription(event.target.value)} /></Field>
            <Field label="Pleito (opcional)"><Select value={electionId} onChange={(event) => setElectionId(event.target.value)}><option value="">Qualquer pleito</option>{elections.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field>
            <Field label="Seed (determinismo)"><Input type="number" min={0} value={seed} onChange={(event) => setSeed(event.target.value)} placeholder="Opcional" /></Field>
            <Field label="Duração (s)"><Input type="number" min={0} value={durationSeconds} onChange={(event) => setDurationSeconds(event.target.value)} placeholder="Opcional" /></Field>
            <Field label="Velocidade padrão"><Select value={speed} onChange={(event) => setSpeed(Number(event.target.value))}>{SIMULATION_SPEEDS.map((value) => <option key={value} value={value}>{value}x</option>)}</Select></Field>
            <label><input type="checkbox" checked={isTemplate} onChange={(event) => setIsTemplate(event.target.checked)} /> Salvar como template (não executável, apenas clonagem)</label>

            <h3>Objetivos</h3>
            {objectives.map((objective, index) => <div className={styles.eventRow} key={index}>
              <span className={styles.eventIndex}>Objetivo {index + 1}</span>
              <div className={styles.eventFields}>
                <Field label="Métrica"><Select value={objective.key} onChange={(event) => setObjectives((current) => current.map((entry, i) => i === index ? { ...entry, key: event.target.value as SimulationDimension } : entry))}>{SIMULATION_DIMENSIONS.map((dimension) => <option key={dimension} value={dimension}>{SIMULATION_DIMENSION_LABELS[dimension]}</option>)}</Select></Field>
                <Field label="Direção"><Select value={objective.direction} onChange={(event) => setObjectives((current) => current.map((entry, i) => i === index ? { ...entry, direction: event.target.value as "AT_LEAST" | "AT_MOST" } : entry))}><option value="AT_LEAST">Pelo menos</option><option value="AT_MOST">No máximo</option></Select></Field>
                <Field label="Alvo"><Input type="number" value={objective.target} onChange={(event) => setObjectives((current) => current.map((entry, i) => i === index ? { ...entry, target: Number(event.target.value) } : entry))} /></Field>
                <Field label="Peso"><Input type="number" min={0} value={objective.weight} onChange={(event) => setObjectives((current) => current.map((entry, i) => i === index ? { ...entry, weight: Number(event.target.value) } : entry))} /></Field>
                <Field label="Rótulo"><Input value={objective.label} onChange={(event) => setObjectives((current) => current.map((entry, i) => i === index ? { ...entry, label: event.target.value } : entry))} /></Field>
              </div>
              <Button type="button" secondary onClick={() => setObjectives((current) => current.filter((_, i) => i !== index))}>Remover</Button>
            </div>)}
            <div className={styles.formActions}><Button type="button" secondary onClick={() => setObjectives((current) => [...current, emptyObjective()])}>Adicionar objetivo</Button></div>

            {([["Critérios de sucesso", successCriteria, setSuccessCriteria], ["Critérios de falha", failureCriteria, setFailureCriteria]] as const).map(([label, list, setList]) => <div key={label}>
              <h3>{label}</h3>
              {list.map((criterion, index) => <div className={styles.eventRow} key={index}>
                <div className={styles.eventFields}>
                  <Field label="Métrica"><Select value={criterion.metric} onChange={(event) => setList((current) => current.map((entry, i) => i === index ? { ...entry, metric: event.target.value as SimulationDimension } : entry))}>{SIMULATION_DIMENSIONS.map((dimension) => <option key={dimension} value={dimension}>{SIMULATION_DIMENSION_LABELS[dimension]}</option>)}</Select></Field>
                  <Field label="Operador"><Select value={criterion.operator} onChange={(event) => setList((current) => current.map((entry, i) => i === index ? { ...entry, operator: event.target.value as "GTE" | "LTE" } : entry))}><option value="GTE">≥</option><option value="LTE">≤</option></Select></Field>
                  <Field label="Valor"><Input type="number" value={criterion.value} onChange={(event) => setList((current) => current.map((entry, i) => i === index ? { ...entry, value: Number(event.target.value) } : entry))} /></Field>
                  <Field label="Rótulo"><Input value={criterion.label} onChange={(event) => setList((current) => current.map((entry, i) => i === index ? { ...entry, label: event.target.value } : entry))} /></Field>
                </div>
                <Button type="button" secondary onClick={() => setList((current) => current.filter((_, i) => i !== index))}>Remover</Button>
              </div>)}
              <div className={styles.formActions}><Button type="button" secondary onClick={() => setList((current) => [...current, emptyCriterion()])}>Adicionar</Button></div>
            </div>)}

            <h3>Pesos do score</h3>
            <p className={styles.hint}>Padrão: {SIMULATION_DIMENSIONS.map((dimension) => `${SIMULATION_DIMENSION_LABELS[dimension]} ${DEFAULT_SIMULATION_WEIGHTS[dimension]}`).join(" · ")}. A soma dos pesos não pode ser zero.</p>
            <div className={styles.eventFields}>{SIMULATION_DIMENSIONS.map((dimension) => <Field key={dimension} label={SIMULATION_DIMENSION_LABELS[dimension]}><Input type="number" min={0} value={weights[dimension] ?? ""} placeholder={String(DEFAULT_SIMULATION_WEIGHTS[dimension])} onChange={(event) => setWeights((current) => ({ ...current, [dimension]: event.target.value === "" ? undefined : Number(event.target.value) }))} /></Field>)}</div>

            {!editing && <div className={styles.eventList}>{drafts.map((draft, index) => <div className={styles.eventRow} key={index}><span className={styles.eventIndex}>Evento {index + 1}</span><EventFields value={draft} onChange={(next) => setDrafts((current) => current.map((entry, entryIndex) => (entryIndex === index ? next : entry)))} /></div>)}</div>}
            <div className={styles.formActions}><Button type="submit" disabled={busy}>{editing ? "Salvar cenário" : "Criar cenário"}</Button>{editing && scenario.data?.status === "DRAFT" && <Button type="button" secondary disabled={busy} onClick={() => id && void run(() => simulatorService.publishScenario(id), () => scenario.reload())}>Publicar</Button>}{editing && scenario.data?.status !== "ARCHIVED" && <Button type="button" secondary disabled={busy} onClick={() => id && void run(() => simulatorService.archiveScenario(id), () => scenario.reload())}>Arquivar</Button>}{editing && <Button type="button" secondary disabled={busy} onClick={() => id && void run(() => simulatorService.deleteScenario(id), () => navigate("/simulator/scenarios"))}>Excluir</Button>}</div>
          </form>
        </Card>
        <Card>
          <h2>Eventos programados</h2>
          {editing ? <ul className={styles.events}>{scenario.data?.events.map((event) => <li key={event.id}>
            <div><strong>{SIMULATION_EVENT_TYPE_LABELS[event.type]}</strong><span>{event.offsetSeconds}s · {event.targetType}{event.targetId ? ` (${event.targetId})` : ""} · {event.probability}%{event.impact ? ` · ${event.impact}` : ""}</span>{event.severity && <Badge tone={event.severity === "CRITICAL" ? "danger" : event.severity === "HIGH" ? "warning" : "neutral"}>{INCIDENT_SEVERITY_LABELS[event.severity]}</Badge>}<Badge tone={event.enabled ? "success" : "neutral"}>{event.enabled ? "Ativo" : "Desativado"}</Badge></div>
            <div className={styles.eventActions}>
              <Button secondary disabled={busy} onClick={() => id && void run(() => simulatorService.updateScenarioEvent(id, event.id, { enabled: !event.enabled }), () => scenario.reload())}>{event.enabled ? "Desativar" : "Ativar"}</Button>
              <Button secondary disabled={busy} onClick={() => id && void run(() => simulatorService.duplicateScenarioEvent(id, event.id), () => scenario.reload())}>Duplicar</Button>
              <Button secondary disabled={busy} onClick={() => id && void run(() => simulatorService.deleteScenarioEvent(id, event.id), () => scenario.reload())}>Remover</Button>
            </div>
          </li>)}</ul> : <p className={styles.hint}>Os eventos informados no formulário serão criados junto com o cenário.</p>}
          {editing && <><h3>Adicionar evento</h3><EventFields value={newEvent} onChange={setNewEvent} /><div className={styles.formActions}><Button type="button" disabled={busy} onClick={addEvent}>Adicionar evento</Button></div></>}
          <p className={styles.hint}>Probabilidade: {Object.entries(FAILURE_PROBABILITY_LABELS).map(([value, label]) => `${label} (${value})`).join(" · ")}.</p>
        </Card>
      </div>
    </section>
  );
}
