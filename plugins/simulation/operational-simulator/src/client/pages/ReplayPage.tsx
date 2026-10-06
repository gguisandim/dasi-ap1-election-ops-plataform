import { useEffect, useState } from "react";
import { Badge, Button, Card, EmptyState, ErrorState, LinkButton, Loading, Select, useAsync } from "@eops/ui";
import { INCIDENT_SEVERITY_LABELS } from "@eops/shared/incidents";
import { SIMULATION_EVENT_TYPE_LABELS } from "@eops/shared/simulation";
import { useParams } from "react-router-dom";
import { RESULT_LABELS, simulatorService, type SimulationEventResult } from "../services/simulatorService";
import styles from "../styles/simulator.module.css";

function clock(seconds: number) { const hours = Math.floor(seconds / 3600); const minutes = Math.floor((seconds % 3600) / 60); const rest = seconds % 60; return [hours, minutes, rest].map((value) => String(value).padStart(2, "0")).join(":"); }
const resultTone = (result: SimulationEventResult | null): "success" | "warning" | "danger" | "neutral" => result === "APPLIED" ? "success" : result === "FAILED" ? "danger" : result === "SKIPPED" ? "warning" : "neutral";
const healthTone = (health: unknown): "success" | "warning" | "danger" => health === "CRITICAL" ? "danger" : health === "ATTENTION" ? "warning" : "success";
const plannedTone = (status: string): "success" | "warning" | "neutral" => status === "EXECUTED" ? "success" : status === "PENDING" ? "warning" : "neutral";

export function ReplayPage() {
  const { id = "" } = useParams();
  const replay = useAsync(() => simulatorService.replay(id), [id]);
  const [index, setIndex] = useState(0);

  useEffect(() => { if (replay.data && index > replay.data.frames.length - 1) setIndex(Math.max(0, replay.data.frames.length - 1)); }, [replay.data, index]);

  if (replay.loading) return <Loading />;
  if (replay.error || !replay.data) return <ErrorState error={replay.error ?? new Error("Replay indisponível.")} onRetry={replay.reload} />;

  const frames = replay.data.frames;
  const frame = frames[index];
  const seek = (offset: number) => { const found = frames.findIndex((entry) => entry.offsetSeconds === offset); if (found >= 0) setIndex(found); };

  return (
    <section className={styles.page}>
      <LinkButton secondary to={`/simulator/runs/${id}`}>Voltar à execução</LinkButton>
      <header><span>REPLAY</span><h1>Reconstrução por offset</h1><p>Quadros determinísticos gravados a cada evento aplicado. Relógio lógico final: {clock(replay.data.elapsedSeconds)}.</p></header>
      {frames.length === 0 ? <EmptyState title="Sem quadros de replay" description="A execução ainda não avançou o relógio." /> : <>
        <Card>
          <div className={styles.filters}>
            <Button secondary disabled={index <= 0} onClick={() => setIndex((current) => current - 1)}>Anterior</Button>
            <Select value={String(frame?.offsetSeconds ?? 0)} onChange={(event) => seek(Number(event.target.value))}>{frames.map((entry) => <option key={entry.offsetSeconds} value={entry.offsetSeconds}>{clock(entry.offsetSeconds)}</option>)}</Select>
            <Button secondary disabled={index >= frames.length - 1} onClick={() => setIndex((current) => current + 1)}>Próximo</Button>
          </div>
          {frame && <div className={styles.controlHeader}><Badge tone={healthTone(frame.health)}>Saúde: {frame.health}</Badge><span className={styles.hint}>{frame.events.length} evento(s) neste quadro ({index + 1} de {frames.length})</span></div>}
        </Card>
        <Card>
          <h2>Eventos do quadro</h2>
          {!frame || frame.events.length === 0 ? <p className={styles.hint}>Nenhum evento neste quadro.</p> : <ol className={styles.timeline}>{frame.events.map((event) => <li key={event.id}><time>{clock(event.offsetSeconds)}</time><div><strong>{event.title}</strong><small>{SIMULATION_EVENT_TYPE_LABELS[event.eventType as keyof typeof SIMULATION_EVENT_TYPE_LABELS] ?? event.eventType}{event.severity ? ` · ${INCIDENT_SEVERITY_LABELS[event.severity]}` : ""}</small><p>{event.description}</p></div>{event.result && <Badge tone={resultTone(event.result)}>{RESULT_LABELS[event.result] ?? event.result}</Badge>}</li>)}</ol>}
        </Card>
      </>}
      <Card>
        <h2>Eventos programados</h2>
        <ul className={styles.scenarios}>{replay.data.plannedEvents.map((event) => <li key={event.id}><div className={styles.scenarioMain}><strong>{SIMULATION_EVENT_TYPE_LABELS[event.type]}</strong><span>{clock(event.offsetSeconds)}{event.impact ? ` · ${event.impact}` : ""}</span></div><Badge tone={plannedTone(event.status)}>{event.status === "EXECUTED" ? "Executado" : event.status === "PENDING" ? "Pendente" : "Desativado"}</Badge></li>)}</ul>
        {replay.data.plannedEvents.length === 0 && <p className={styles.hint}>Execução sem cenário programado.</p>}
      </Card>
    </section>
  );
}
