import { Card, EmptyState, ErrorState, LinkButton, Loading, useAsync } from "@eops/ui";
import { Link } from "react-router-dom";
import { simulatorService } from "../services/simulatorService";
import styles from "../styles/simulator.module.css";

export function ScenariosPage() {
  const scenarios = useAsync(simulatorService.scenarios, []);
  return <section className={styles.page}><LinkButton secondary to="/simulator">Voltar ao simulador</LinkButton><header><span>SIMULAÇÃO</span><h1>Cenários</h1><p>Programe eventos com deslocamento, alvo, severidade e probabilidade para treinar respostas.</p></header><div className={styles.toolbar}><LinkButton to="/simulator/scenarios/new">Novo cenário</LinkButton></div>{scenarios.loading && <Loading />}{scenarios.error && <ErrorState error={scenarios.error} onRetry={scenarios.reload} />}{scenarios.data?.length === 0 && <EmptyState title="Nenhum cenário" description="Crie o primeiro cenário programado." />}<Card><ul className={styles.runs}>{scenarios.data?.map((scenario) => <li key={scenario.id}><div><Link to={`/simulator/scenarios/${scenario.id}`}>{scenario.name}</Link><span>{scenario.description || "Sem descrição"}</span></div><b>{scenario.events.length} evento(s)</b><small>{scenario.seed !== null ? `seed ${scenario.seed}` : "sem seed"}{scenario.durationSeconds !== null ? ` · ${scenario.durationSeconds}s` : ""}</small></li>)}</ul></Card></section>;
}
