import { useState } from "react";
import { Badge, Button, Card, EmptyState, ErrorState, LinkButton, Loading, useAsync } from "@eops/ui";
import { useParams } from "react-router-dom";
import { routesService } from "../../services/routesService";
import { DELIVERY_STATUS_LABELS, ROUTE_STATUS_LABELS, type RouteStatus, type RouteStopStatus } from "../../types";
import styles from "../../styles/overview.module.css";

const actionLabels: Partial<Record<RouteStatus, string>> = {
  PLANNED: "Voltar ao planejamento",
  READY: "Liberar rota",
  DISPATCHED: "Despachar",
  IN_PROGRESS: "Registrar saída",
  DELAYED: "Registrar atraso",
  COMPLETED: "Concluir rota",
  CANCELLED: "Cancelar rota",
};

export function RouteDetailPage() {
  const { id = "" } = useParams();
  const route = useAsync(() => routesService.get(id), [id]);
  const [actionError, setActionError] = useState<Error>();
  async function transition(status: RouteStatus) {
    const reason = status === "CANCELLED" ? window.prompt("Motivo do cancelamento") ?? undefined : undefined;
    if (status === "CANCELLED" && !reason) return;
    setActionError(undefined);
    try { await routesService.transition(id, { status, reason }); route.reload(); }
    catch (error) { setActionError(error instanceof Error ? error : new Error("Não foi possível atualizar a rota.")); }
  }
  async function stopAction(stopId: string, status: RouteStopStatus) {
    const reason = ["FAILED", "SKIPPED"].includes(status) ? window.prompt("Motivo da exceção") ?? undefined : undefined;
    if (["FAILED", "SKIPPED"].includes(status) && !reason) return;
    setActionError(undefined);
    try { await routesService.stopAction(id, stopId, { status, reason }); route.reload(); }
    catch (error) { setActionError(error instanceof Error ? error : new Error("Não foi possível atualizar a parada.")); }
  }
  async function moveStop(index: number, direction: -1 | 1) {
    if (!route.data) return;
    const ids = route.data.stops.map((stop) => stop.id);
    const target = index + direction;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    try { await routesService.reorderStops(id, ids); route.reload(); }
    catch (error) { setActionError(error instanceof Error ? error : new Error("Não foi possível reordenar as paradas.")); }
  }
  async function resolveException(exceptionId: string) {
    const resolution = window.prompt("Como a exceção foi resolvida?");
    if (!resolution) return;
    try { await routesService.resolveException(id, exceptionId, resolution); route.reload(); }
    catch (error) { setActionError(error instanceof Error ? error : new Error("Não foi possível resolver a exceção.")); }
  }
  if (route.loading) return <Loading label="Carregando rota…" />;
  if (route.error || !route.data) return <ErrorState error={route.error ?? new Error("Rota não encontrada.")} onRetry={route.reload} />;
  const data = route.data;
  return <section className={styles.page}>
    <header className={styles.header}><div><span className={styles.tag}>{data.code}</span><h1>{data.name}</h1><p>{data.description || `${data.originName} → ${data.destinationName}`}</p></div><div className={styles.actions}><LinkButton secondary to={`/routes/${data.id}/history`}>Histórico</LinkButton><LinkButton secondary to={`/routes/map?routeId=${data.id}`}>Mapa</LinkButton>{["PLANNED", "READY"].includes(data.status) && <LinkButton to={`/routes/${data.id}/edit`}>Editar</LinkButton>}</div></header>
    {actionError && <ErrorState error={actionError} />}
    <div className={styles.metrics}><Card><span>Status</span><strong>{ROUTE_STATUS_LABELS[data.status]}</strong></Card><Card><span>Risco</span><strong>{data.deliveryRisk}</strong></Card><Card><span>Carga</span><strong>{data.loadUnits}{data.vehicle?.capacity ? ` / ${data.vehicle.capacity}` : ""}</strong></Card><Card><span>Ativos em trânsito</span><strong>{data.assetsInTransit}</strong></Card><Card><span>Exceções abertas</span><strong>{data.openExceptions}</strong></Card></div>
    <div className={styles.actions}>{data.availableActions.map((status) => <Button key={status} onClick={() => void transition(status)}>{actionLabels[status] ?? status}</Button>)}</div>
    <div className={styles.detailGrid}><Card><h2>Operação</h2><dl><dt>Pleito</dt><dd>{data.election.name}</dd><dt>Zona</dt><dd>{data.electoralZone.number} · {data.electoralZone.name}</dd><dt>Responsável</dt><dd>{data.responsibleName}</dd><dt>Motorista</dt><dd>{data.driverName || "—"}</dd><dt>Veículo</dt><dd>{data.vehicle ? `${data.vehicle.identification} · ${data.vehicle.plate}` : "—"}</dd></dl></Card><Card><h2>Planejamento</h2><dl><dt>Origem</dt><dd>{data.originName}</dd><dt>Destino</dt><dd>{data.destinationName}</dd><dt>Saída</dt><dd>{new Date(data.plannedDeparture).toLocaleString("pt-BR")}</dd><dt>Chegada</dt><dd>{new Date(data.plannedArrival).toLocaleString("pt-BR")}</dd><dt>Atraso</dt><dd>{data.delayMinutes} min</dd></dl></Card></div>
    <Card><div className={styles.sectionTitle}><h2>Sequência de paradas</h2><span>{data.stops.filter((stop) => stop.status === "COMPLETED").length}/{data.stops.length} concluídas</span></div>{data.stops.length === 0 ? <EmptyState title="Sem paradas" description="Inclua paradas durante o planejamento." /> : <ol className={styles.timeline}>{data.stops.map((stop, index) => <li key={stop.id}><div><strong>{stop.order}. {stop.pollingPlace?.name ?? stop.description}</strong><span>ETA {new Date(stop.eta).toLocaleString("pt-BR")} · {stop.status}</span>{stop.notes && <small>{stop.notes}</small>}</div><div className={styles.rowActions}>{["PLANNED", "READY"].includes(data.status) && <><Button disabled={index === 0} onClick={() => void moveStop(index, -1)}>↑</Button><Button disabled={index === data.stops.length - 1} onClick={() => void moveStop(index, 1)}>↓</Button></>}{stop.status === "PENDING" && !["PLANNED", "READY", "COMPLETED", "CANCELLED"].includes(data.status) && <><Button onClick={() => void stopAction(stop.id, "ARRIVED")}>Chegada</Button><Button onClick={() => void stopAction(stop.id, "SKIPPED")}>Pular</Button></>}{stop.status === "ARRIVED" && <><Button onClick={() => void stopAction(stop.id, "COMPLETED")}>Concluir</Button><Button onClick={() => void stopAction(stop.id, "FAILED")}>Falha</Button></>}</div></li>)}</ol>}</Card>
    <Card><div className={styles.sectionTitle}><h2>Carga e lotes</h2><LinkButton to={`/routes/deliveries?routeId=${data.id}`}>Gerenciar entregas</LinkButton></div>{data.batches.length === 0 ? <p>Nenhum lote criado.</p> : <div className={styles.batchGrid}>{data.batches.map((batch) => <article key={batch.id}><strong>{batch.code}</strong><span>{batch.itemCount} itens · {batch.placesCount} locais</span><span>{batch.pendingCount} pendentes · {batch.completedCount} concluídas · {batch.failedCount} falhas</span></article>)}</div>}</Card>
    <Card><h2>Entregas</h2>{data.deliveries.length === 0 ? <EmptyState title="Sem entregas" description="A rota ainda não possui carga." /> : <div className={styles.tableWrap}><table><thead><tr><th>Local</th><th>Itens</th><th>Recebedor</th><th>Comprovante</th><th>Status</th></tr></thead><tbody>{data.deliveries.map((delivery) => <tr key={delivery.id}><td>{delivery.pollingPlace.name}</td><td>{delivery.items.reduce((sum, item) => sum + item.quantity, 0)}</td><td>{delivery.receiverName || "—"}</td><td>{delivery.proofUrl ? <a href={delivery.proofUrl} target="_blank" rel="noreferrer">Abrir</a> : "—"}</td><td><Badge tone={delivery.status === "DELIVERED" ? "success" : delivery.status === "FAILED" ? "danger" : "neutral"}>{DELIVERY_STATUS_LABELS[delivery.status]}</Badge></td></tr>)}</tbody></table></div>}</Card>
    <Card><h2>Exceções</h2>{data.exceptions.length === 0 ? <EmptyState title="Sem exceções" description="Nenhuma ocorrência logística registrada." /> : <div className={styles.tableWrap}><table><thead><tr><th>Motivo</th><th>Descrição</th><th>Quando</th><th>Estado</th><th>Ação</th></tr></thead><tbody>{data.exceptions.map((item) => <tr key={item.id}><td>{item.reason}</td><td>{item.notes || "—"}</td><td>{new Date(item.occurredAt).toLocaleString("pt-BR")}</td><td>{item.resolvedAt ? `Resolvida · ${item.resolution}` : "Aberta"}</td><td>{!item.resolvedAt && <Button onClick={() => void resolveException(item.id)}>Resolver</Button>}</td></tr>)}</tbody></table></div>}</Card>
  </section>;
}
