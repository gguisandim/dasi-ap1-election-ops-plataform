import { EmptyState, ErrorState, LinkButton, Loading, useAsync } from "@eops/ui";
import { Link } from "react-router-dom";
import { HandoverNav } from "../components/HandoverNav";
import { shiftHandoversService, statusLabel } from "../services/shiftHandoversService";
import styles from "../styles/shift-handovers.module.css";

export function HandoverDashboardPage() {
  const state = useAsync(shiftHandoversService.dashboard, []);
  return <section className={styles.page}>
    <HandoverNav />
    <header className={styles.header}><div><span>Operações · Continuidade</span><h1>Passagens de Turno</h1><p>Pendências, riscos e contexto confirmados entre equipes.</p></div><LinkButton to="/shift-handovers/new">Nova passagem</LinkButton></header>
    {state.loading && <Loading label="Carregando passagens…" />}
    {state.error && <ErrorState error={state.error} onRetry={state.reload} />}
    {state.data && <>
      <div className={styles.metrics}>
        {[['Meus rascunhos', state.data.drafts], ['Aguardando confirmação', state.data.pending], ['Aguardando minha confirmação', state.data.pendingForMe], ['Confirmadas hoje', state.data.confirmedToday]].map(([label, value]) => <div className={styles.metric} key={label}><span>{label}</span><strong>{value}</strong></div>)}
      </div>
      <section className={styles.panel}><h2>Atividade recente</h2>
        {!state.data.recent.length ? <EmptyState title="Nenhuma passagem registrada" description="Crie a primeira passagem quando um turno estiver em andamento ou concluído." /> : <div className={styles.list}>{state.data.recent.map((item) => <div className={styles.row} key={item.id}><div><Link to={`/shift-handovers/${item.id}`}>{item.shift.name ?? 'Turno'}</Link><small>{new Date(item.updatedAt).toLocaleString('pt-BR')}</small></div><span>{item.sender.name} → {item.recipient.name}</span><span>{statusLabel[item.status]}</span><Link to={`/shift-handovers/${item.id}`}>Abrir</Link></div>)}</div>}
      </section>
    </>}
  </section>;
}
