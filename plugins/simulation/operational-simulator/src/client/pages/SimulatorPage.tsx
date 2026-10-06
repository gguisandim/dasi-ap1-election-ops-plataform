import { useEffect, useState, type FormEvent } from "react";
import { Button, Card, EmptyState, ErrorState, Field, Input, LinkButton, Loading, Select, useAsync } from "@eops/ui";
import type { ElectionSummary } from "@eops/shared/elections";
import { SIMULATION_SPEEDS } from "@eops/shared/simulation";
import { Link, useNavigate } from "react-router-dom";
import { FAILURE_PROBABILITY_LABELS, SIMULATION_STATUS_LABELS, simulatorService, type FailureProbability, type SimulationScenario } from "../services/simulatorService";
import styles from "../styles/simulator.module.css";

const FLAGS = ["connectivity", "equipment", "transmission", "logistics"] as const;
type FlagKey = (typeof FLAGS)[number];

export function SimulatorPage() {
  const navigate = useNavigate();
  const simulations = useAsync(simulatorService.list, []);
  const [elections, setElections] = useState<ElectionSummary[]>([]);
  const [scenarios, setScenarios] = useState<SimulationScenario[]>([]);
  const [name, setName] = useState("Simulação do dia da eleição");
  const [electionId, setElection] = useState("");
  const [scenarioId, setScenarioId] = useState("");
  const [speed, setSpeed] = useState(5);
  const [probability, setProbability] = useState<FailureProbability>("MEDIUM");
  const [flags, setFlags] = useState<Record<FlagKey, boolean>>({ connectivity: true, equipment: true, transmission: true, logistics: true });
  const [apply, setApply] = useState(false);
  const [error, setError] = useState<unknown>();

  useEffect(() => {
    void simulatorService.elections().then((items) => { setElections(items); setElection((current) => current || items[0]?.id || ""); });
    void simulatorService.scenarios({ status: "PUBLISHED" }).then(setScenarios).catch(() => setScenarios([]));
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(undefined);
    try {
      const simulation = await simulatorService.create({ name, electionId, scenarioId: scenarioId || undefined, speed, probability, ...flags, applyToOperations: apply });
      navigate(`/simulator/runs/${simulation.id}`);
    } catch (cause) { setError(cause); }
  }

  return (
    <section className={styles.page}>
      <header><span>SIMULAÇÃO</span><h1>Simulador Operacional</h1><p>Treine respostas e acompanhe incidentes simulados sem confundi-los com ocorrências reais.</p></header>
      <div className={styles.toolbar}><LinkButton secondary to="/simulator/scenarios">Cenários programados</LinkButton><LinkButton secondary to="/simulator/runs">Execuções</LinkButton><LinkButton secondary to="/simulator/compare">Comparar</LinkButton></div>
      {error !== undefined && <ErrorState error={error} />}
      {simulations.data && simulations.data.length > 0 && <div className={styles.indicators}>{(["RUNNING", "PAUSED", "COMPLETED", "FAILED", "CANCELLED"] as const).map((status) => <div key={status}><span>{SIMULATION_STATUS_LABELS[status]}</span><b>{simulations.data?.filter((item) => item.status === status).length ?? 0}</b></div>)}</div>}
      <div className={styles.grid}>
        <Card>
          <h2>Nova simulação</h2>
          <form onSubmit={(event) => void submit(event)}>
            <Field label="Nome"><Input required value={name} onChange={(event) => setName(event.target.value)} /></Field>
            <Field label="Pleito"><Select required value={electionId} onChange={(event) => setElection(event.target.value)}>{elections.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field>
            <Field label="Cenário publicado"><Select value={scenarioId} onChange={(event) => setScenarioId(event.target.value)}><option value="">Sem cenário (falhas genéricas)</option>{scenarios.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.eventCount ?? item.events.length} evento(s))</option>)}</Select></Field>
            <Field label="Velocidade"><Select value={speed} onChange={(event) => setSpeed(Number(event.target.value))}>{SIMULATION_SPEEDS.map((value) => <option key={value} value={value}>{value}x</option>)}</Select></Field>
            <Field label="Probabilidade"><Select value={probability} onChange={(event) => setProbability(event.target.value as FailureProbability)}>{Object.entries(FAILURE_PROBABILITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></Field>
            <fieldset><legend>Falhas automáticas</legend>{FLAGS.map((key) => <label key={key}><input type="checkbox" checked={flags[key]} onChange={(event) => setFlags((current) => ({ ...current, [key]: event.target.checked }))} /> {key}</label>)}</fieldset>
            <label className={styles.warning}><input type="checkbox" checked={apply} onChange={(event) => setApply(event.target.checked)} /> Aplicar temporariamente o estado aos ativos (restaurado ao encerrar)</label>
            <Button type="submit">Criar simulação</Button>
          </form>
        </Card>
        <Card>
          <h2>Execuções recentes</h2>
          {simulations.loading && <Loading />}
          {simulations.error && <ErrorState error={simulations.error} onRetry={simulations.reload} />}
          {simulations.data?.length === 0 && <EmptyState title="Nenhuma simulação" description="Configure a primeira execução." />}
          <ul className={styles.runs}>{simulations.data?.map((item) => <li key={item.id}><div><Link to={`/simulator/runs/${item.id}`}>{item.name}</Link><span>{item.election?.name ?? "Pleito"} · {item.speed}x · {FAILURE_PROBABILITY_LABELS[item.probability]}</span></div><b data-status={item.status}>{SIMULATION_STATUS_LABELS[item.status]}</b><small>{item._count?.events ?? 0} eventos</small></li>)}</ul>
        </Card>
      </div>
    </section>
  );
}
