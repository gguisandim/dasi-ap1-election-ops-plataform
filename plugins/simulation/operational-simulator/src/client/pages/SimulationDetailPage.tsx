import { useEffect, useRef, useState } from "react";
import { Badge, Button, Card, EmptyState, ErrorState, Field, Input, LinkButton, Loading, Select, useAsync } from "@eops/ui";
import { INCIDENT_SEVERITY_LABELS } from "@eops/shared/incidents";
import { SIMULATION_DECISION_KINDS, SIMULATION_DECISION_KIND_LABELS, SIMULATION_DIMENSION_LABELS, SIMULATION_DIMENSIONS, type SimulationDecisionKind } from "@eops/shared/simulation";
import { Link, useParams } from "react-router-dom";
import { RESULT_LABELS, SIMULATION_EVENT_LABELS, SIMULATION_STATUS_LABELS, simulatorService, type SimulationEventResult } from "../services/simulatorService";
import styles from "../styles/simulator.module.css";

function clock(seconds: number) { const hours = Math.floor(seconds / 3600); const minutes = Math.floor((seconds % 3600) / 60); const rest = seconds % 60; return [hours, minutes, rest].map((value) => String(value).padStart(2, "0")).join(":"); }
const resultTone = (result: SimulationEventResult | null): "success" | "warning" | "danger" | "neutral" => result === "APPLIED" ? "success" : result === "FAILED" ? "danger" : result === "SKIPPED" ? "warning" : "neutral";
const healthTone = (health: unknown): "success" | "warning" | "danger" => health === "CRITICAL" ? "danger" : health === "ATTENTION" ? "warning" : "success";

export function SimulationDetailPage() {
  const { id = "" } = useParams();
  const { data, loading, error, reload } = useAsync(() => simulatorService.get(id), [id]);
  const [actionError, setActionError] = useState<unknown>();
  const [failReason, setFailReason] = useState("");
  const [decisionKind, setDecisionKind] = useState<SimulationDecisionKind>("ESCALATE");
  const [rationale, setRationale] = useState("");
  const busy = useRef(false);
  const terminal = data ? ["FINISHED", "FAILED", "CANCELLED"].includes(data.status) : false;
  const report = useAsync(() => (terminal ? simulatorService.report(id) : Promise.resolve(undefined)), [id, terminal]);

  async function action(operation: () => Promise<unknown>) { if (busy.current) return; busy.current = true; setActionError(undefined); try { await operation(); reload(); } catch (cause) { setActionError(cause); } finally { busy.current = false; } }
  useEffect(() => { if (data?.status !== "RUNNING") return; const timer = window.setInterval(() => void action(() => simulatorService.tick(id)), 5000); return () => window.clearInterval(timer); }, [data?.status, id]);

  if (loading) return <Loading />;
  if (error || !data) return <ErrorState error={error ?? new Error("Simulação não encontrada.")} onRetry={reload} />;
  const latestSnapshot = data.snapshots.at(-1);

  return (
    <section className={styles.page}>
      <LinkButton secondary to="/simulator/runs">Voltar às execuções</LinkButton>
      <header><span>SIMULAÇÃO OPERACIONAL</span><h1>{data.name}</h1><p>{data.election.name} · relógio {clock(data.elapsedSeconds)} · velocidade {data.speed}x{data.scenario ? ` · cenário ${data.scenario.name}` : ""}</p></header>
      {actionError !== undefined && <ErrorState error={actionError} />}
      <div className={styles.controls}>
        <Card>
          <div className={styles.controlHeader}>
            <Badge tone={data.status === "FAILED" ? "danger" : data.status === "CANCELLED" ? "neutral" : data.status === "COMPLETED" ? "success" : "warning"}>{SIMULATION_STATUS_LABELS[data.status]}</Badge>
            {latestSnapshot && <Badge tone={healthTone(latestSnapshot.health)}>Saúde: {latestSnapshot.health}</Badge>}
          </div>
          <div className={styles.controlActions}>
            <Button disabled={!["CREATED", "PAUSED"].includes(data.status)} onClick={() => void action(() => simulatorService.start(id))}>Iniciar</Button>
            <Button disabled={data.status !== "RUNNING"} onClick={() => void action(() => simulatorService.pause(id))}>Pausar</Button>
            <Button disabled={data.status !== "RUNNING"} onClick={() => void action(() => simulatorService.step(id))}>Passo</Button>
            <Button disabled={data.status !== "RUNNING"} onClick={() => void action(() => simulatorService.tick(id))}>Avançar</Button>
            <Button disabled={terminal} onClick={() => void action(() => simulatorService.finish(id))}>Encerrar</Button>
            <Button secondary disabled={terminal} onClick={() => void action(() => simulatorService.cancel(id))}>Cancelar</Button>
          </div>
          <div className={styles.controlActions}>
            <Field label="Motivo da falha forçada"><Input value={failReason} minLength={3} onChange={(event) => setFailReason(event.target.value)} placeholder="Ex.: queda do datacenter" /></Field>
            <Button secondary disabled={terminal || failReason.trim().length < 3} onClick={() => void action(() => simulatorService.fail(id, failReason.trim()))}>Registrar falha</Button>
          </div>
          <p>{data.applyToOperations ? "Estados dos ativos são aplicados temporariamente (revertidos ao encerrar)." : "Modo isolado: ativos produtivos não são alterados."}</p>
          {data.failureReason && <p className={styles.warning}>{data.failureReason}</p>}
        </Card>
      </div>

      {data.score !== null && <Card>
        <h2>Score</h2>
        <div className={styles.score}><strong>{data.score}</strong><span>de 100</span></div>
        {report.loading && <Loading />}
        {report.error && <ErrorState error={report.error} onRetry={report.reload} />}
        {report.data && <>
          <div className={styles.metrics}>{SIMULATION_DIMENSIONS.map((dimension) => <div key={dimension}><span>{SIMULATION_DIMENSION_LABELS[dimension]}</span><b>{report.data?.breakdown.dimensions[dimension] ?? 0}</b></div>)}</div>
          <div className={styles.metrics}>{[["Previstos", report.data.plannedEvents], ["Executados", report.data.executedEvents], ["Falhos", report.data.failedEvents], ["Incidentes", report.data.incidentsCreated], ["Resolvidos", report.data.resolvedIncidents], ["Falhas transmissão", report.data.transmissionFailures], ["Recuperações", report.data.transmissionRecoveries], ["Recuperação média (s)", report.data.averageRecoverySeconds], ["Violações SLA", report.data.slaViolations], ["Não resolvidos", report.data.unresolved]].map(([label, value]) => <div key={String(label)}><span>{label}</span><b>{value}</b></div>)}</div>
        </>}
      </Card>}

      <Card>
        <div className={styles.sectionHeader}><h2>Decisões</h2><LinkButton secondary to={`/simulator/runs/${id}/replay`}>Ver replay</LinkButton></div>
        <div className={styles.controlActions}>
          <Field label="Tipo de decisão"><Select value={decisionKind} onChange={(event) => setDecisionKind(event.target.value as SimulationDecisionKind)}>{SIMULATION_DECISION_KINDS.map((kind) => <option key={kind} value={kind}>{SIMULATION_DECISION_KIND_LABELS[kind]}</option>)}</Select></Field>
          <Field label="Justificativa"><Input value={rationale} minLength={3} onChange={(event) => setRationale(event.target.value)} /></Field>
          <Button disabled={rationale.trim().length < 3} onClick={() => void action(() => simulatorService.recordDecision(id, { kind: decisionKind, rationale: rationale.trim() }))}>Registrar decisão</Button>
        </div>
        {data.decisions.length === 0 && <EmptyState title="Nenhuma decisão registrada" description="Registre as decisões tomadas durante a execução." />}
        <ul className={styles.timeline}>{data.decisions.map((decision) => <li key={decision.id}><time>{clock(decision.offsetSeconds)}</time><div><strong>{SIMULATION_DECISION_KIND_LABELS[decision.kind]}</strong><p>{decision.rationale}</p>{decision.actor && <span>{decision.actor.name}</span>}</div></li>)}</ul>
      </Card>

      <Card>
        <h2>Linha do tempo</h2>
        <ol className={styles.timeline}>{data.events.map((event) => { const target = (event.payload?.targetId as string | undefined) ?? ""; return <li key={event.id}><time>{clock(event.offsetSeconds)}</time><div><strong>{event.title}</strong><small>{SIMULATION_EVENT_LABELS[event.eventType as keyof typeof SIMULATION_EVENT_LABELS] ?? event.eventType}{event.severity ? ` · ${INCIDENT_SEVERITY_LABELS[event.severity]}` : ""}{target ? ` · alvo ${target}` : ""}</small><p>{event.description}</p><span>{event.asset?.assetTag} {event.pollingPlace?.name} {event.incident?.code}</span></div>{event.result && <Badge tone={resultTone(event.result)}>{RESULT_LABELS[event.result] ?? event.result}</Badge>}</li>; })}</ol>
        {data.events.length === 0 && <p className={styles.hint}>Nenhum evento registrado ainda. Inicie a simulação e avance o relógio.</p>}
      </Card>
      <p className={styles.hint}><Link to="/simulator/scenarios">Gerenciar cenários programados</Link></p>
    </section>
  );
}
