import { Breadcrumb, Card, EmptyState, ErrorState, LinkButton, Loading, useAsync } from "@eops/ui";
import { formatDateTime } from "@eops/shared/format";
import { Link, useParams } from "react-router-dom";
import { AssetConditionBadge, AssetStatusBadge } from "../components/AssetBadge";
import { inventoryService } from "../services/inventoryService";
import styles from "../styles/inventory.module.css";

export function AssetDetailPage() {
  const { id = "" } = useParams(); const { data, loading, error, reload } = useAsync(() => inventoryService.get(id), [id]);
  if (loading) return <Loading />; if (error || !data) return <ErrorState error={error ?? new Error("Ativo não encontrado.")} onRetry={reload} />;
  return <section className={styles.page}><Breadcrumb items={[{ label: "Inventário", to: "/inventory" }, { label: data.assetTag }]} /><header className={styles.header}><div><div className={styles.badges}><AssetStatusBadge status={data.status} /><AssetConditionBadge condition={data.condition} /></div><h1>{data.assetTag} · {data.name}</h1><p>{data.type.name} · {[data.manufacturer, data.model].filter(Boolean).join(" ") || "Sem fabricante/modelo informado"}</p></div><div className={styles.headerActions}><LinkButton secondary to={`/inventory/${id}/edit`}>Editar</LinkButton><LinkButton to={`/inventory/${id}/move`}>Movimentar</LinkButton></div></header>
    <div className={styles.detailGrid}><Card><h2>Identificação e localização</h2><dl><dt>Série</dt><dd>{data.serialNumber ?? "—"}</dd><dt>Zona</dt><dd>{data.electoralZone ? `Zona ${data.electoralZone.number}` : "—"}</dd><dt>Local</dt><dd>{data.pollingPlace?.name ?? "Depósito central"}</dd><dt>Município</dt><dd>{data.pollingPlace?.city ?? data.electoralZone?.municipality ?? "—"}</dd></dl></Card><Card><h2>Incidentes vinculados</h2>{!data.incidents?.length ? <EmptyState title="Sem incidentes ativos" description="Nenhum incidente aberto para este ativo." /> : <ul className={styles.related}>{data.incidents.map((incident) => <li key={incident.id}><Link to={`/incidents/${incident.id}`}>{incident.code}</Link><span>{incident.title}</span></li>)}</ul>}</Card></div>
    <Card><h2>Histórico de movimentações</h2>{!data.movements?.length ? <EmptyState title="Sem movimentações" description="O ativo ainda não possui histórico de transporte ou alocação." /> : <ol className={styles.movements}>{data.movements.map((movement) => <li key={movement.id}><time>{formatDateTime(movement.movedAt)}</time><strong>{movement.originLabel} → {movement.destinationLabel}</strong><span>{movement.reason} · {movement.responsibleName}</span></li>)}</ol>}</Card>
  </section>;
}
