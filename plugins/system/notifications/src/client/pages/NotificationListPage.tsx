import { useState } from "react";
import { Button, EmptyState, ErrorState, Input, LinkButton, Loading, Pagination, Select, useAsync } from "@eops/ui";
import { formatDateTime } from "@eops/shared/format";
import { Link } from "react-router-dom";
import { notificationService, type NotificationFilters } from "../services/notificationService";
import styles from "../styles/notifications.module.css";

export function NotificationListPage() {
  const [query, setQuery] = useState<NotificationFilters>({ readState: "ALL", type: "", eventName: "", page: 1, pageSize: 20 });
  const { data, loading, error, reload } = useAsync(() => notificationService.list(query), [JSON.stringify(query)]);
  const unread = useAsync(notificationService.unreadCount, []);
  const set = (value: Partial<NotificationFilters>) => setQuery((current) => ({ ...current, ...value, page: value.page ?? 1 }));
  async function mutate(action: () => Promise<unknown>) { await action(); reload(); unread.reload(); }
  return <section className={styles.page}><header><div><span>SISTEMA</span><h1>Notificações</h1><p>{unread.data?.count ?? 0} não lidas</p></div><div className={styles.headerActions}><LinkButton secondary to="/notifications/preferences">Preferências</LinkButton><Button disabled={!unread.data?.count} onClick={() => void mutate(notificationService.readAll)}>Marcar todas como lidas</Button></div></header>
    <div className={styles.tabs} role="group" aria-label="Estado das notificações"><button aria-pressed={query.readState === "ALL"} onClick={() => set({ readState: "ALL" })}>Todas</button><button aria-pressed={query.readState === "UNREAD"} onClick={() => set({ readState: "UNREAD" })}>Não lidas</button><button aria-pressed={query.type === "CRITICAL"} onClick={() => set({ type: query.type === "CRITICAL" ? "" : "CRITICAL" })}>Críticas</button></div>
    <div className={styles.filters}><Select aria-label="Tipo" value={query.type} onChange={(event) => set({ type: event.target.value as NotificationFilters["type"] })}><option value="">Todos os tipos</option><option value="INFO">Informação</option><option value="WARNING">Alerta</option><option value="CRITICAL">Crítica</option><option value="SUCCESS">Sucesso</option></Select><Input aria-label="Evento" placeholder="Filtrar por evento" value={query.eventName} onChange={(event) => set({ eventName: event.target.value })} /><Input aria-label="Data inicial" type="date" value={query.from ?? ""} onChange={(event) => set({ from: event.target.value })} /><Input aria-label="Data final" type="date" value={query.to ?? ""} onChange={(event) => set({ to: event.target.value })} /></div>
    {loading && <Loading label="Carregando notificações…" />}{error && <ErrorState error={error} onRetry={reload} />}{data?.items.length === 0 && <EmptyState title="Sem notificações" description="Nenhuma notificação corresponde aos filtros atuais." />}
    <ul className={styles.list}>{data?.items.map((item) => <li key={item.id} className={item.readAt ? styles.read : styles.unread}><div className={styles.notification}><i data-type={item.type} /><div><div className={styles.notificationHeading}><strong>{item.title}</strong><span>{item.type}</span></div><p>{item.message}</p><div className={styles.notificationMeta}><time>{formatDateTime(item.createdAt)}</time><code>{item.eventName ?? "evento não informado"}</code>{item.entityType === "Incident" && item.entityId && <Link to={`/incidents/${item.entityId}`}>Abrir incidente</Link>}</div></div><Button secondary onClick={() => void mutate(() => item.readAt ? notificationService.unread(item.id) : notificationService.read(item.id))}>{item.readAt ? "Marcar não lida" : "Marcar lida"}</Button></div></li>)}</ul>
    {data && data.totalPages > 0 && <Pagination page={data.page} totalPages={data.totalPages} onChange={(page) => set({ page })} />}
  </section>;
}
