import { useEffect, useState } from "react";
import { Card, EmptyState, ErrorState, LinkButton, Loading, Pagination, useAsync } from "@eops/ui";
import { formatDateTime } from "@eops/shared/format";
import { type IncidentCategorySummary } from "@eops/shared/incidents";
import { Link, useSearchParams } from "react-router-dom";
import { IncidentFilters } from "../components/IncidentFilters";
import { IncidentStatusBadge, SeverityBadge } from "../components/IncidentBadge";
import { incidentService, type IncidentFilters as Filters } from "../services/incidentService";
import styles from "../styles/incidents.module.css";

export function IncidentListPage() {
  const [searchParams] = useSearchParams();
  const [filters, setFilters] = useState<Filters>({ page: 1, pageSize: 20, pollingPlaceId: searchParams.get("pollingPlaceId") ?? undefined });
  const [categories, setCategories] = useState<IncidentCategorySummary[]>([]);
  const { data, error, loading, reload } = useAsync(() => incidentService.list(filters), [JSON.stringify(filters)]);
  const dashboard = useAsync(incidentService.dashboard, []);
  useEffect(() => { void incidentService.categories().then(setCategories); }, []);
  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div><span className={styles.eyebrow}>MONITORAMENTO</span><h1>Central de Incidentes</h1><p>Triagem, atendimento, SLA e histórico operacional.</p></div>
        <LinkButton to="/incidents/new">Novo incidente</LinkButton>
      </header>
      {dashboard.data && <div className={styles.metrics}>
        <Card><span>Abertos</span><strong>{dashboard.data.open}</strong></Card>
        <Card><span>Críticos</span><strong>{dashboard.data.critical}</strong></Card>
        <Card><span>Em atendimento</span><strong>{dashboard.data.inProgress}</strong></Card>
        <Card><span>Resolvidos hoje</span><strong>{dashboard.data.resolvedToday}</strong></Card>
        <Card><span>SLA vencido</span><strong>{dashboard.data.slaOverdue}</strong></Card>
      </div>}
      <IncidentFilters value={filters} categories={categories} onChange={setFilters} />
      {loading && <Loading label="Carregando incidentes…" />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {data?.items.length === 0 && <EmptyState title="Nenhum incidente encontrado" description="Ajuste os filtros ou registre um novo incidente." action={<LinkButton to="/incidents/new">Registrar incidente</LinkButton>} />}
      {data && data.items.length > 0 && <>
        <div className={styles.tableWrap}><table><thead><tr><th>Código</th><th>Incidente</th><th>Severidade</th><th>Status</th><th>Local</th><th>Responsável</th><th>Abertura</th><th>SLA</th></tr></thead>
          <tbody>{data.items.map((incident) => <tr key={incident.id}>
            <td><Link to={`/incidents/${incident.id}`}>{incident.code}</Link></td>
            <td><strong>{incident.title}</strong><small>{incident.category.name}</small></td>
            <td><SeverityBadge severity={incident.severity} /></td><td><IncidentStatusBadge status={incident.status} /></td>
            <td>{incident.pollingPlace?.name ?? incident.electoralZone?.name ?? "—"}</td><td>{incident.assignedToName ?? "Não atribuído"}</td>
            <td>{formatDateTime(incident.openedAt)}</td><td className={incident.slaOverdue ? styles.overdue : ""}>{incident.slaDeadline ? formatDateTime(incident.slaDeadline) : "—"}</td>
          </tr>)}</tbody></table></div>
        <Pagination page={data.page} totalPages={data.totalPages} onChange={(page) => setFilters((current) => ({ ...current, page }))} />
      </>}
    </section>
  );
}
