import { EmptyState, ErrorState, LinkButton, Loading, Pagination, Select, useAsync } from "@eops/ui";
import { useState } from "react";
import { Link } from "react-router-dom";
import { HandoverNav } from "../components/HandoverNav";
import { shiftHandoversService, statusLabel } from "../services/shiftHandoversService";
import styles from "../styles/shift-handovers.module.css";

export function HandoverListPage() {
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const state = useAsync(() => shiftHandoversService.list({ status: status || undefined, page, pageSize: 20 }), [status, page]);
  return <section className={styles.page}>
    <HandoverNav />
    <header className={styles.header}><div><span>Operações · Histórico</span><h1>Todas as passagens</h1><p>Consulte rascunhos, confirmações e cancelamentos.</p></div><LinkButton to="/shift-handovers/new">Nova passagem</LinkButton></header>
    <div className={styles.filters}><label className={styles.field}>Status<Select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="">Todos</option><option value="DRAFT">Rascunho</option><option value="PENDING_CONFIRMATION">Aguardando confirmação</option><option value="CONFIRMED">Confirmada</option><option value="CANCELLED">Cancelada</option></Select></label></div>
    {state.loading && <Loading />}{state.error && <ErrorState error={state.error} onRetry={state.reload} />}
    {state.data && (!state.data.items.length ? <EmptyState title="Nenhum resultado" description="Não há passagens para o filtro selecionado." /> : <section className={styles.panel}><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Turno</th><th>Remetente</th><th>Destinatário</th><th>Status</th><th>Atualização</th></tr></thead><tbody>{state.data.items.map((item) => <tr key={item.id}><td><Link to={`/shift-handovers/${item.id}`}>{item.shift.name ?? 'Turno'}</Link></td><td>{item.sender.name}</td><td>{item.recipient.name}</td><td>{statusLabel[item.status]}</td><td>{new Date(item.updatedAt).toLocaleString('pt-BR')}</td></tr>)}</tbody></table></div><Pagination page={state.data.page} totalPages={state.data.totalPages} onChange={setPage} /></section>)}
  </section>;
}
