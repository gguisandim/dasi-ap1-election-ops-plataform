import { useEffect, useState } from "react";
import { Badge, Card, EmptyState, ErrorState, Input, LinkButton, Loading, Select, useAsync } from "@eops/ui";
import { Link } from "react-router-dom";
import { routesService } from "../../services/routesService";
import { ROUTE_STATUSES, ROUTE_STATUS_LABELS, type RouteFilters, type RouteStatus } from "../../types";
import styles from "../../styles/overview.module.css";

const tone = (status: RouteStatus) => status === "COMPLETED" ? "success" : status === "DELAYED" || status === "CANCELLED" ? "danger" : status === "IN_PROGRESS" ? "warning" : "neutral";

export function RouteListPage() {
  const [filters, setFilters] = useState<RouteFilters>({});
  const routes = useAsync(() => routesService.list(filters), [JSON.stringify(filters)]);
  const dashboard = useAsync(() => routesService.dashboard(filters), [JSON.stringify(filters)]);
  const references = useAsync(routesService.references, []);
  useEffect(() => { if (filters.electionId && references.data && !references.data.zones.some((zone) => zone.electionId === filters.electionId && zone.id === filters.zoneId)) setFilters((value) => ({ ...value, zoneId: undefined })); }, [filters.electionId, filters.zoneId, references.data]);
  const change = (key: keyof RouteFilters, value: string) => setFilters((current) => ({ ...current, [key]: value || undefined }));
  const zones = references.data?.zones.filter((zone) => !filters.electionId || zone.electionId === filters.electionId) ?? [];
  return <section className={styles.page}>
    <header className={styles.header}><div><span className={styles.tag}>LOGÍSTICA</span><h1>Rotas e Distribuição</h1><p>Planejamento, execução, entregas e atrasos da operação logística.</p></div><div className={styles.actions}><LinkButton secondary to="/routes/deliveries">Entregas</LinkButton><LinkButton secondary to="/routes/map">Mapa</LinkButton><LinkButton to="/routes/new">Nova rota</LinkButton></div></header>
    {dashboard.data && <div className={styles.metrics}><Card><span>Rotas</span><strong>{dashboard.data.total}</strong></Card><Card><span>Prontas / despachadas</span><strong>{dashboard.data.ready + dashboard.data.dispatched}</strong></Card><Card><span>Em risco</span><strong>{dashboard.data.atRisk}</strong></Card><Card><span>Atrasos ativos</span><strong>{dashboard.data.delayed}</strong></Card><Card><span>Exceções abertas</span><strong>{dashboard.data.openExceptions}</strong></Card></div>}
    <div className={styles.filters}>
      <Select aria-label="Pleito" value={filters.electionId ?? ""} onChange={(event) => change("electionId", event.target.value)}><option value="">Todos os pleitos</option>{references.data?.elections.map((election) => <option key={election.id} value={election.id}>{election.name}</option>)}</Select>
      <Select aria-label="Zona" value={filters.zoneId ?? ""} onChange={(event) => change("zoneId", event.target.value)}><option value="">Todas as zonas</option>{zones.map((zone) => <option key={zone.id} value={zone.id}>Zona {zone.number} · {zone.name}</option>)}</Select>
      <Select aria-label="Status" value={filters.status ?? ""} onChange={(event) => change("status", event.target.value)}><option value="">Todos os status</option>{ROUTE_STATUSES.map((status) => <option key={status} value={status}>{ROUTE_STATUS_LABELS[status]}</option>)}</Select>
      <Input aria-label="Responsável" placeholder="Responsável" value={filters.responsible ?? ""} onChange={(event) => change("responsible", event.target.value)} />
      <Input aria-label="Data inicial" type="date" value={filters.from ?? ""} onChange={(event) => change("from", event.target.value)} />
      <Input aria-label="Data final" type="date" value={filters.to ?? ""} onChange={(event) => change("to", event.target.value)} />
    </div>
    {routes.loading && <Loading label="Carregando rotas…" />}{routes.error && <ErrorState error={routes.error} onRetry={routes.reload} />}
    {routes.data?.length === 0 && <EmptyState title="Nenhuma rota encontrada" description="Ajuste os filtros ou cadastre a primeira rota." action={<LinkButton to="/routes/new">Cadastrar rota</LinkButton>} />}
    {routes.data && routes.data.length > 0 && <div className={styles.tableWrap}><table><thead><tr><th>Rota</th><th>Pleito / zona</th><th>Planejamento</th><th>Carga</th><th>Status</th><th>Risco</th></tr></thead><tbody>{routes.data.map((route) => <tr key={route.id}><td><Link to={`/routes/${route.id}`}><strong>{route.code}</strong></Link><small>{route.name}</small></td><td>{route.election.name}<small>Zona {route.electoralZone.number}</small></td><td>{new Date(route.plannedDeparture).toLocaleString("pt-BR")}<small>até {new Date(route.plannedArrival).toLocaleString("pt-BR")}</small></td><td>{route.loadUnits} unidades<small>{route.assetsInTransit} ativos identificados</small></td><td><Badge tone={tone(route.status)}>{ROUTE_STATUS_LABELS[route.status]}</Badge></td><td><Badge tone={route.deliveryRisk === "ON_TIME" ? "success" : route.deliveryRisk === "AT_RISK" ? "warning" : "danger"}>{route.deliveryRisk}</Badge><small>{route.openExceptions} exceções abertas</small></td></tr>)}</tbody></table></div>}
  </section>;
}
