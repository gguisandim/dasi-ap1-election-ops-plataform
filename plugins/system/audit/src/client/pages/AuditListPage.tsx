import { useState } from "react";
import { Card, EmptyState, ErrorState, Input, Loading, Pagination, Select, useAsync } from "@eops/ui";
import { formatDateTime } from "@eops/shared/format";
import { Link } from "react-router-dom";
import { RestrictedNotice, SeverityBadge } from "../components";
import { auditService, defaultPeriod, type AuditQuery } from "../services/auditService";
import styles from "../styles/audit.module.css";

const ACTIONS = ["CREATE", "UPDATE", "DELETE", "ASSIGN", "STATUS_CHANGE", "SEVERITY_CHANGE", "ACKNOWLEDGE", "ESCALATE", "COMMENT", "RESOLVE", "REOPEN", "CLOSE", "CANCEL"];

export function AuditListPage() {
  const [query, setQuery] = useState<AuditQuery>({
    ...defaultPeriod(),
    action: "",
    category: "",
    severity: "",
    eventName: "",
    entityType: "",
    entityId: "",
    correlationId: "",
    search: "",
    page: 1,
    pageSize: 30,
  });
  const set = (key: keyof AuditQuery, value: string | number) =>
    setQuery((current) => ({ ...current, [key]: value, page: key === "page" ? Number(value) : 1 }) as AuditQuery);

  const explorer = useAsync(() => auditService.explorer(query), [JSON.stringify(query)]);
  const summary = useAsync(() => auditService.summary(query), [JSON.stringify({ ...query, page: 1 })]);
  const vocabulary = useAsync(() => auditService.categories({ ...query, page: 1 }), [query.from, query.to]);

  const restricted = explorer.data?.restrictedCategories ?? summary.data?.restrictedCategories ?? [];
  const facets = explorer.data?.facets;

  return <section className={styles.page}>
    <header><span>SISTEMA</span><h1>Auditoria</h1><p>Rastreabilidade de eventos de domínio e ações operacionais.</p></header>
    {summary.data && <div className={styles.summary}>
      <Card><span>Eventos no período</span><strong>{summary.data.total}</strong></Card>
      <Card><span>Eventos hoje</span><strong>{summary.data.today}</strong></Card>
      <Card><span>Categoria mais frequente</span><strong>{summary.data.byCategory[0]?.key ?? "—"}</strong><small>{summary.data.byCategory[0]?.count ?? 0} eventos</small></Card>
      <Card><span>Severidade dominante</span><strong>{summary.data.bySeverity[0]?.key ?? "—"}</strong><small>{summary.data.bySeverity[0]?.count ?? 0} eventos</small></Card>
    </div>}
    <RestrictedNotice categories={restricted} />
    <div className={styles.filters}>
      <Input aria-label="Busca" placeholder="Buscar evento, recurso, ator ou ID" value={query.search} onChange={(event) => set("search", event.target.value)} />
      <Select aria-label="Ação" value={query.action} onChange={(event) => set("action", event.target.value)}><option value="">Todas as ações</option>{ACTIONS.map((action) => <option key={action}>{action}</option>)}</Select>
      <Select aria-label="Categoria" value={query.category} onChange={(event) => set("category", event.target.value)}><option value="">Todas as categorias</option>{vocabulary.data?.categories.map((item) => <option key={item.key} value={item.key}>{item.key} ({item.count})</option>)}</Select>
      <Select aria-label="Severidade" value={query.severity} onChange={(event) => set("severity", event.target.value)}><option value="">Todas as severidades</option>{vocabulary.data?.severities.map((item) => <option key={item.key} value={item.key}>{item.key} ({item.count})</option>)}</Select>
      <Input aria-label="Evento" placeholder="Evento, ex.: incident.assigned" value={query.eventName} onChange={(event) => set("eventName", event.target.value)} />
      <Input aria-label="Tipo de recurso" placeholder="Tipo de recurso" value={query.entityType} onChange={(event) => set("entityType", event.target.value)} />
      <Input aria-label="Correlation ID" placeholder="Correlation ID" value={query.correlationId} onChange={(event) => set("correlationId", event.target.value)} />
      <Input aria-label="Data inicial" type="date" value={query.from} onChange={(event) => set("from", event.target.value)} />
      <Input aria-label="Data final" type="date" value={query.to} onChange={(event) => set("to", event.target.value)} />
    </div>
    {facets && facets.byCategory.length > 0 && <div className={styles.facets} aria-label="Filtros por categoria">
      {facets.byCategory.map((item) => <button key={item.key} type="button" className={styles.facet} onClick={() => set("category", item.key)}><span>{item.key}</span><b>{item.count}</b></button>)}
    </div>}
    {explorer.loading && <Loading label="Carregando trilha de auditoria…" />}
    {explorer.error && <ErrorState error={explorer.error} onRetry={explorer.reload} />}
    {explorer.data?.items.length === 0 && <EmptyState title="Nenhum evento encontrado" description="Ajuste os filtros para ampliar a pesquisa." />}
    {explorer.data && explorer.data.items.length > 0 && <>
      <div className={styles.table}><table><thead><tr><th>Data</th><th>Ator</th><th>Ação</th><th>Evento</th><th>Categoria</th><th>Severidade</th><th>Recurso</th><th>Detalhe</th></tr></thead><tbody>
        {explorer.data.items.map((event) => <tr key={event.id}>
          <td>{formatDateTime(event.createdAt)}</td>
          <td>{event.actor?.name ?? "Sistema"}</td>
          <td><span className={styles.actionBadge}>{event.action}</span></td>
          <td><code>{event.eventName ?? "—"}</code>{event.correlationId && <small><Link to={`/audit/correlation/${event.correlationId}`}>{event.correlationId}</Link></small>}</td>
          <td>{event.category ?? "—"}</td>
          <td><SeverityBadge severity={event.severity} /></td>
          <td><Link to={`/audit/entities/${encodeURIComponent(event.entityType)}/${encodeURIComponent(event.entityId ?? "")}`}><strong>{event.entityType}</strong><small>{event.entityId ?? "—"}</small></Link></td>
          <td><Link to={`/audit/${event.id}`}>Ver evento</Link></td>
        </tr>)}
      </tbody></table></div>
      <Pagination page={explorer.data.page} totalPages={explorer.data.totalPages} onChange={(page) => set("page", page)} />
    </>}
  </section>;
}
