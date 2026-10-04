import { useState } from "react";
import { Card, EmptyState, ErrorState, Input, Loading, Pagination, Select, useAsync } from "@eops/ui";
import { formatDateTime } from "@eops/shared/format";
import { Link } from "react-router-dom";
import { auditService } from "../services/auditService";
import styles from "../styles/audit.module.css";

const actions = ["CREATE", "UPDATE", "DELETE", "ASSIGN", "STATUS_CHANGE", "SEVERITY_CHANGE", "ACKNOWLEDGE", "ESCALATE", "COMMENT", "RESOLVE", "REOPEN", "CLOSE", "CANCEL"];

export function AuditListPage() {
  const [query, setQuery] = useState({ action: "", eventName: "", entityType: "", search: "", from: "", to: "", page: 1, pageSize: 30 });
  const { data, loading, error, reload } = useAsync(() => auditService.list(query), [JSON.stringify(query)]);
  const summary = useAsync(() => auditService.summary({ from: query.from, to: query.to }), [query.from, query.to]);
  const set = (key: string, value: string | number) => setQuery((current) => ({ ...current, [key]: value, page: key === "page" ? Number(value) : 1 }));
  return <section className={styles.page}>
    <header><span>SISTEMA</span><h1>Auditoria</h1><p>Rastreabilidade de eventos de domínio e ações operacionais.</p></header>
    {summary.data && <div className={styles.summary}><Card><span>Eventos no período</span><strong>{summary.data.total}</strong></Card><Card><span>Eventos hoje</span><strong>{summary.data.today}</strong></Card><Card><span>Ação mais frequente</span><strong>{summary.data.byAction[0]?.action ?? "—"}</strong><small>{summary.data.byAction[0]?.count ?? 0} eventos</small></Card><Card><span>Recurso mais alterado</span><strong>{summary.data.topEntities[0]?.entityType ?? "—"}</strong><small>{summary.data.topEntities[0]?.count ?? 0} eventos</small></Card></div>}
    <div className={styles.filters}><Input aria-label="Busca" placeholder="Buscar evento, recurso, ator ou ID" value={query.search} onChange={(event) => set("search", event.target.value)} /><Select aria-label="Ação" value={query.action} onChange={(event) => set("action", event.target.value)}><option value="">Todas as ações</option>{actions.map((action) => <option key={action}>{action}</option>)}</Select><Input aria-label="Evento" placeholder="Evento, ex.: incident.assigned" value={query.eventName} onChange={(event) => set("eventName", event.target.value)} /><Input aria-label="Tipo de recurso" placeholder="Tipo de recurso" value={query.entityType} onChange={(event) => set("entityType", event.target.value)} /><Input aria-label="Data inicial" type="date" value={query.from} onChange={(event) => set("from", event.target.value)} /><Input aria-label="Data final" type="date" value={query.to} onChange={(event) => set("to", event.target.value)} /></div>
    {loading && <Loading label="Carregando trilha de auditoria…" />}{error && <ErrorState error={error} onRetry={reload} />}
    {data?.items.length === 0 && <EmptyState title="Nenhum evento encontrado" description="Ajuste os filtros para ampliar a pesquisa." />}
    {data && data.items.length > 0 && <><div className={styles.table}><table><thead><tr><th>Data</th><th>Ator</th><th>Ação</th><th>Evento</th><th>Recurso</th><th>Detalhe</th></tr></thead><tbody>{data.items.map((event) => <tr key={event.id}><td>{formatDateTime(event.createdAt)}</td><td>{event.actor?.name ?? "Sistema"}</td><td><span className={styles.actionBadge}>{event.action}</span></td><td><code>{event.eventName ?? "—"}</code></td><td><strong>{event.entityType}</strong><small>{event.entityId ?? "—"}</small></td><td><Link to={`/audit/${event.id}`}>Ver evento</Link></td></tr>)}</tbody></table></div><Pagination page={data.page} totalPages={data.totalPages} onChange={(page) => set("page", page)} /></>}
  </section>;
}
