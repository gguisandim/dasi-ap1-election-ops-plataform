import { Badge, Button, Card, ErrorState, LinkButton, Loading, useAsync } from "@eops/ui";
import { useParams } from "react-router-dom";
import { routesService } from "../../services/routesService";
import { DELIVERY_STATUS_LABELS, ROUTE_STATUS_LABELS, type RouteStatus } from "../../types";
import styles from "../../styles/overview.module.css";

export function RouteDetailPage() {
  const { id = "" } = useParams();
  const route = useAsync(() => routesService.get(id), [id]);
  async function transition(status: RouteStatus) {
    const now = new Date().toISOString();
    await routesService.update(id, { status, ...(status === "IN_PROGRESS" ? { actualDeparture: now } : {}), ...(status === "COMPLETED" ? { actualArrival: now } : {}) });
    route.reload();
  }
  async function completeStop(stopId: string) { await routesService.updateStop(id, stopId, { status: "COMPLETED", actualAt: new Date().toISOString() }); route.reload(); }
  if (route.loading) return <Loading label="Carregando rota…" />;
  if (route.error || !route.data) return <ErrorState error={route.error ?? new Error("Rota não encontrada.")} onRetry={route.reload} />;
  const data = route.data;
  return <section className={styles.page}>
    <header className={styles.header}><div><span className={styles.tag}>{data.code}</span><h1>{data.name}</h1><p>{data.description || `${data.originName} → ${data.destinationName}`}</p></div><div className={styles.actions}><LinkButton secondary to={`/routes/${data.id}/history`}>Histórico</LinkButton><LinkButton secondary to={`/routes/map?routeId=${data.id}`}>Mapa</LinkButton><LinkButton to={`/routes/${data.id}/edit`}>Editar</LinkButton></div></header>
    <div className={styles.metrics}><Card><span>Status</span><strong>{ROUTE_STATUS_LABELS[data.status]}</strong></Card><Card><span>Atraso</span><strong>{data.delayMinutes} min</strong></Card><Card><span>Paradas</span><strong>{data.stops.length}</strong></Card><Card><span>Entregas</span><strong>{data.deliveries.length}</strong></Card><Card><span>Lotes</span><strong>{data.batches.length}</strong></Card></div>
    <div className={styles.actions}>{["PLANNED", "READY"].includes(data.status) && <Button onClick={() => void transition("IN_PROGRESS")}>Registrar saída</Button>}{["IN_PROGRESS", "DELAYED"].includes(data.status) && <Button onClick={() => void transition("COMPLETED")}>Registrar chegada</Button>}{!["COMPLETED", "CANCELLED"].includes(data.status) && <Button onClick={() => void transition("CANCELLED")}>Cancelar rota</Button>}</div>
    <div className={styles.detailGrid}><Card><h2>Operação</h2><dl><dt>Pleito</dt><dd>{data.election.name}</dd><dt>Zona</dt><dd>{data.electoralZone.number} · {data.electoralZone.name}</dd><dt>Responsável</dt><dd>{data.responsibleName}</dd><dt>Motorista</dt><dd>{data.driverName || "—"}</dd><dt>Veículo</dt><dd>{data.vehicle ? `${data.vehicle.identification} · ${data.vehicle.plate}` : "—"}</dd></dl></Card><Card><h2>Planejamento</h2><dl><dt>Origem</dt><dd>{data.originName}</dd><dt>Destino</dt><dd>{data.destinationName}</dd><dt>Saída</dt><dd>{new Date(data.plannedDeparture).toLocaleString("pt-BR")}</dd><dt>Chegada</dt><dd>{new Date(data.plannedArrival).toLocaleString("pt-BR")}</dd></dl></Card></div>
    <Card><div className={styles.sectionTitle}><h2>Sequência de paradas</h2><span>{data.stops.filter((stop) => stop.status === "COMPLETED").length}/{data.stops.length} concluídas</span></div><ol className={styles.timeline}>{data.stops.map((stop) => <li key={stop.id}><div><strong>{stop.order}. {stop.pollingPlace?.name ?? stop.description}</strong><span>ETA {new Date(stop.eta).toLocaleString("pt-BR")} · {stop.status}</span>{stop.notes && <small>{stop.notes}</small>}</div>{stop.status === "PENDING" && <Button onClick={() => void completeStop(stop.id)}>Concluir parada</Button>}</li>)}</ol></Card>
    <Card><div className={styles.sectionTitle}><h2>Lotes</h2><LinkButton to={`/routes/deliveries?routeId=${data.id}`}>Gerenciar entregas</LinkButton></div>{data.batches.length === 0 ? <p>Nenhum lote criado.</p> : <div className={styles.batchGrid}>{data.batches.map((batch) => <article key={batch.id}><strong>{batch.code}</strong><span>{batch.itemCount} itens · {batch.placesCount} locais</span><span>{batch.pendingCount} pendentes · {batch.completedCount} concluídas · {batch.failedCount} falhas</span></article>)}</div>}</Card>
    <Card><h2>Entregas recentes</h2>{data.deliveries.length === 0 ? <p>Nenhuma entrega cadastrada.</p> : <div className={styles.tableWrap}><table><thead><tr><th>Local</th><th>Itens</th><th>Recebedor</th><th>Status</th></tr></thead><tbody>{data.deliveries.map((delivery) => <tr key={delivery.id}><td>{delivery.pollingPlace.name}</td><td>{delivery.items.reduce((sum, item) => sum + item.quantity, 0)}</td><td>{delivery.receiverName || "—"}</td><td><Badge tone={delivery.status === "DELIVERED" ? "success" : delivery.status === "FAILED" ? "danger" : "neutral"}>{DELIVERY_STATUS_LABELS[delivery.status]}</Badge></td></tr>)}</tbody></table></div>}</Card>
  </section>;
}
