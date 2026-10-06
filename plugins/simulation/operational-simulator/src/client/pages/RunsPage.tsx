import { useState } from "react";
import { Badge, Card, EmptyState, ErrorState, LinkButton, Loading, Pagination, Select, useAsync } from "@eops/ui";
import { Link } from "react-router-dom";
import { FAILURE_PROBABILITY_LABELS, SIMULATION_STATUS_LABELS, simulatorService } from "../services/simulatorService";
import styles from "../styles/simulator.module.css";

const STATUS_OPTIONS = ["CREATED", "RUNNING", "PAUSED", "COMPLETED", "FAILED", "CANCELLED"];
const tone = (status: string): "neutral" | "success" | "warning" | "danger" => status === "FAILED" ? "danger" : status === "CANCELLED" ? "neutral" : status === "COMPLETED" ? "success" : "warning";

export function RunsPage() {
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const runs = useAsync(() => simulatorService.runs({ status: status || undefined, page, pageSize: 20 }), [status, page]);

  return (
    <section className={styles.page}>
      <LinkButton secondary to="/simulator">Voltar ao simulador</LinkButton>
      <header><span>SIMULAÇÃO</span><h1>Execuções</h1><p>Panorama das simulações com status, score, velocidade e volume de eventos.</p></header>
      <div className={styles.toolbar}><LinkButton secondary to="/simulator/compare">Comparar execuções</LinkButton></div>
      <Card>
        <div className={styles.filters}>
          <Select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="">Todos os status</option>{STATUS_OPTIONS.map((value) => <option key={value} value={value}>{SIMULATION_STATUS_LABELS[value as keyof typeof SIMULATION_STATUS_LABELS]}</option>)}</Select>
        </div>
        {runs.loading && <Loading />}
        {runs.error && <ErrorState error={runs.error} onRetry={runs.reload} />}
        {runs.data && runs.data.items.length === 0 && <EmptyState title="Nenhuma execução" description="Nenhuma simulação corresponde ao filtro." />}
        <ul className={styles.runs}>{runs.data?.items.map((run) => <li key={run.id}>
          <div><Link to={`/simulator/runs/${run.id}`}>{run.name}</Link><span>{run.election?.name ?? "Pleito"} · {run.speed}x · {FAILURE_PROBABILITY_LABELS[run.probability]} · {run.elapsedSeconds}s</span>{run.failureReason && <small>{run.failureReason}</small>}</div>
          <Badge tone={tone(run.status)}>{SIMULATION_STATUS_LABELS[run.status]}</Badge>
          <small>{run.score !== null ? `score ${run.score}` : "sem score"} · {run._count?.events ?? 0} eventos</small>
        </li>)}</ul>
        {runs.data && runs.data.totalPages > 1 && <Pagination page={runs.data.page} totalPages={runs.data.totalPages} onChange={setPage} />}
      </Card>
    </section>
  );
}
