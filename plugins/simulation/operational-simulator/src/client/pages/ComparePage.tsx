import { useState } from "react";
import { Badge, Button, Card, EmptyState, ErrorState, LinkButton, Loading, useAsync } from "@eops/ui";
import { SIMULATION_DIMENSION_LABELS } from "@eops/shared/simulation";
import { Link } from "react-router-dom";
import { SIMULATION_STATUS_LABELS, simulatorService, type SimulationComparison } from "../services/simulatorService";
import styles from "../styles/simulator.module.css";

export function ComparePage() {
  const runs = useAsync(() => simulatorService.runs({ pageSize: 50 }), []);
  const [selected, setSelected] = useState<string[]>([]);
  const [result, setResult] = useState<SimulationComparison>();
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);

  function toggle(id: string) { setSelected((current) => current.includes(id) ? current.filter((entry) => entry !== id) : current.length >= 6 ? current : [...current, id]); }
  async function compare() {
    setBusy(true); setError(undefined);
    try { setResult(await simulatorService.compare(selected)); } catch (cause) { setError(cause); setResult(undefined); } finally { setBusy(false); }
  }

  return (
    <section className={styles.page}>
      <LinkButton secondary to="/simulator/runs">Voltar às execuções</LinkButton>
      <header><span>SIMULAÇÃO</span><h1>Comparar execuções</h1><p>Selecione de 2 a 6 execuções do mesmo pleito. Dimensões ausentes aparecem como lacuna, nunca como zero.</p></header>
      {error !== undefined && <ErrorState error={error} />}
      <Card>
        <h2>Execuções disponíveis</h2>
        {runs.loading && <Loading />}
        {runs.error && <ErrorState error={runs.error} onRetry={runs.reload} />}
        {runs.data?.items.length === 0 && <EmptyState title="Nenhuma execução" description="Execute simulações antes de comparar." />}
        <ul className={styles.scenarios}>{runs.data?.items.map((run) => <li key={run.id}>
          <label className={styles.selectRow}><input type="checkbox" checked={selected.includes(run.id)} onChange={() => toggle(run.id)} /><div className={styles.scenarioMain}><Link to={`/simulator/runs/${run.id}`}>{run.name}</Link><span>{run.election?.name ?? "Pleito"} · seed {run.seed ?? "—"}</span></div></label>
          <Badge tone="neutral">{run.score !== null ? `score ${run.score}` : "sem score"}</Badge>
        </li>)}</ul>
        <div className={styles.formActions}><Button disabled={busy || selected.length < 2 || selected.length > 6} onClick={() => void compare()}>Comparar selecionadas ({selected.length})</Button></div>
      </Card>

      {result && <Card>
        <div className={styles.controlHeader}><h2>Resultado</h2>{result.seedMismatch && <Badge tone="warning">Seeds diferentes</Badge>}{result.missingDimensions && <Badge tone="neutral">Dimensões ausentes</Badge>}</div>
        <div className={styles.tableWrap}><table className={styles.table}>
          <thead><tr><th>Dimensão</th>{result.runs.map((run) => <th key={run.id}>{run.name}<small>{SIMULATION_STATUS_LABELS[run.status]} · score {run.score ?? "—"}</small></th>)}</tr></thead>
          <tbody>{result.dimensions.map((dimension) => <tr key={dimension}><td>{SIMULATION_DIMENSION_LABELS[dimension]}</td>{result.runs.map((run) => <td key={run.id}>{run.dimensions[dimension] ?? "—"}</td>)}</tr>)}</tbody>
        </table></div>
      </Card>}
    </section>
  );
}
