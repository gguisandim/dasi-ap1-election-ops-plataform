import { useState } from "react";
import { Badge, Button, Card, EmptyState, ErrorState, LinkButton, Loading, Select, useAsync } from "@eops/ui";
import { SCENARIO_STATUSES, SCENARIO_STATUS_LABELS } from "@eops/shared/simulation";
import { Link } from "react-router-dom";
import { simulatorService } from "../services/simulatorService";
import styles from "../styles/simulator.module.css";

const tone = (status: keyof typeof SCENARIO_STATUS_LABELS): "neutral" | "success" | "warning" => status === "PUBLISHED" ? "success" : status === "ARCHIVED" ? "neutral" : "warning";

export function ScenariosPage() {
  const [status, setStatus] = useState("");
  const [templates, setTemplates] = useState("");
  const scenarios = useAsync(() => simulatorService.scenarios({ status: status || undefined, isTemplate: templates === "" ? undefined : templates === "true" }), [status, templates]);
  const [error, setError] = useState<unknown>();
  async function run(operation: () => Promise<unknown>) { setError(undefined); try { await operation(); scenarios.reload(); } catch (cause) { setError(cause); } }

  return (
    <section className={styles.page}>
      <LinkButton secondary to="/simulator">Voltar ao simulador</LinkButton>
      <header><span>SIMULAÇÃO</span><h1>Cenários</h1><p>Programe eventos com deslocamento, alvo, severidade e probabilidade. Rascunhos podem ser editados; publique para executar.</p></header>
      <div className={styles.toolbar}><LinkButton to="/simulator/scenarios/new">Novo cenário</LinkButton></div>
      {error !== undefined && <ErrorState error={error} />}
      <div className={styles.filters}>
        <Select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Todos os status</option>{SCENARIO_STATUSES.map((value) => <option key={value} value={value}>{SCENARIO_STATUS_LABELS[value]}</option>)}</Select>
        <Select value={templates} onChange={(event) => setTemplates(event.target.value)}><option value="">Cenários e templates</option><option value="false">Somente cenários</option><option value="true">Somente templates</option></Select>
      </div>
      {scenarios.loading && <Loading />}
      {scenarios.error && <ErrorState error={scenarios.error} onRetry={scenarios.reload} />}
      {scenarios.data?.length === 0 && <EmptyState title="Nenhum cenário" description="Crie o primeiro cenário programado." />}
      <Card>
        <ul className={styles.scenarios}>{scenarios.data?.map((scenario) => (
          <li key={scenario.id}>
            <div className={styles.scenarioMain}>
              <Link to={`/simulator/scenarios/${scenario.id}`}>{scenario.name}</Link>
              <span>{scenario.description || "Sem descrição"}</span>
              <small>v{scenario.version} · {scenario.enabledEventCount ?? scenario.events.length}/{scenario.eventCount ?? scenario.events.length} evento(s) ativos{scenario.isTemplate ? " · template" : ""}{scenario.clonedFrom ? ` · clonado de ${scenario.clonedFrom.name} v${scenario.clonedFrom.version}` : ""}</small>
            </div>
            <Badge tone={tone(scenario.status)}>{SCENARIO_STATUS_LABELS[scenario.status]}</Badge>
            <div className={styles.eventActions}>
              {scenario.status !== "PUBLISHED" && scenario.status !== "ARCHIVED" && <Button secondary onClick={() => void run(() => simulatorService.publishScenario(scenario.id))}>Publicar</Button>}
              {scenario.status !== "ARCHIVED" && <Button secondary onClick={() => void run(() => simulatorService.archiveScenario(scenario.id))}>Arquivar</Button>}
              <Button secondary onClick={() => void run(() => simulatorService.cloneScenario(scenario.id))}>Clonar</Button>
            </div>
          </li>
        ))}</ul>
        {scenarios.data && scenarios.data.length === 0 && <p className={styles.hint}>Nenhum cenário cadastrado.</p>}
      </Card>
    </section>
  );
}
