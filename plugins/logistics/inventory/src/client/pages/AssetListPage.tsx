import { useEffect, useState } from "react";
import { Card, EmptyState, ErrorState, Input, LinkButton, Loading, Pagination, Select, useAsync } from "@eops/ui";
import { ASSET_CONDITIONS, ASSET_CONDITION_LABELS, ASSET_STATUSES, ASSET_STATUS_LABELS, type AssetTypeSummary } from "@eops/shared";
import { Link, useSearchParams } from "react-router-dom";
import { AssetConditionBadge, AssetStatusBadge } from "../components/AssetBadge";
import { inventoryService, type AssetFilters } from "../services/inventoryService";
import styles from "../styles/inventory.module.css";

export function AssetListPage() {
  const [searchParams] = useSearchParams();
  const [filters, setFilters] = useState<AssetFilters>({ page: 1, pageSize: 20, pollingPlaceId: searchParams.get("pollingPlaceId") ?? undefined });
  const [types, setTypes] = useState<AssetTypeSummary[]>([]);
  const { data, loading, error, reload } = useAsync(() => inventoryService.list(filters), [JSON.stringify(filters)]);
  const dashboard = useAsync(inventoryService.dashboard, []);
  useEffect(() => { void inventoryService.types().then(setTypes); }, []);
  const change = (key: keyof AssetFilters, value: string) => setFilters((current) => ({ ...current, [key]: value || undefined, page: 1 }));
  return <section className={styles.page}>
    <header className={styles.header}><div><span className={styles.eyebrow}>LOGÍSTICA</span><h1>Inventário e Ativos</h1><p>Patrimônio, alocações e histórico de movimentações.</p></div><div className={styles.headerActions}><LinkButton secondary to="/inventory/types">Tipos</LinkButton><LinkButton to="/inventory/new">Novo ativo</LinkButton></div></header>
    {dashboard.data && <div className={styles.metrics}><Card><span>Total</span><strong>{dashboard.data.total}</strong></Card><Card><span>Alocados</span><strong>{dashboard.data.allocated}</strong></Card><Card><span>Em trânsito</span><strong>{dashboard.data.inTransit}</strong></Card><Card><span>Manutenção</span><strong>{dashboard.data.maintenance}</strong></Card><Card><span>Indisponíveis</span><strong>{dashboard.data.unavailable}</strong></Card></div>}
    <div className={styles.filters}><Input aria-label="Pesquisar ativos" placeholder="Patrimônio, nome ou série" value={filters.search ?? ""} onChange={(event) => change("search", event.target.value)} /><Select aria-label="Tipo" value={filters.typeId ?? ""} onChange={(event) => change("typeId", event.target.value)}><option value="">Todos os tipos</option>{types.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</Select><Select aria-label="Status" value={filters.status ?? ""} onChange={(event) => change("status", event.target.value)}><option value="">Todos os status</option>{ASSET_STATUSES.map((status) => <option key={status} value={status}>{ASSET_STATUS_LABELS[status]}</option>)}</Select><Select aria-label="Condição" value={filters.condition ?? ""} onChange={(event) => change("condition", event.target.value)}><option value="">Todas as condições</option>{ASSET_CONDITIONS.map((condition) => <option key={condition} value={condition}>{ASSET_CONDITION_LABELS[condition]}</option>)}</Select></div>
    {loading && <Loading label="Carregando ativos…" />}{error && <ErrorState error={error} onRetry={reload} />}
    {data?.items.length === 0 && <EmptyState title="Nenhum ativo encontrado" description="Ajuste os filtros ou cadastre o primeiro ativo." action={<LinkButton to="/inventory/new">Cadastrar ativo</LinkButton>} />}
    {data && data.items.length > 0 && <><div className={styles.tableWrap}><table><thead><tr><th>Patrimônio</th><th>Ativo</th><th>Tipo</th><th>Status</th><th>Condição</th><th>Localização</th><th>Ações</th></tr></thead><tbody>{data.items.map((asset) => <tr key={asset.id}><td><Link to={`/inventory/${asset.id}`}>{asset.assetTag}</Link></td><td><strong>{asset.name}</strong><small>{[asset.manufacturer, asset.model].filter(Boolean).join(" · ") || "—"}</small></td><td>{asset.type.name}</td><td><AssetStatusBadge status={asset.status} /></td><td><AssetConditionBadge condition={asset.condition} /></td><td>{asset.pollingPlace?.name ?? (asset.electoralZone ? `Zona ${asset.electoralZone.number}` : "Depósito central")}</td><td><Link to={`/inventory/${asset.id}/move`}>Movimentar</Link></td></tr>)}</tbody></table></div><Pagination page={data.page} totalPages={data.totalPages} onChange={(page) => setFilters((current) => ({ ...current, page }))} /></>}
  </section>;
}
