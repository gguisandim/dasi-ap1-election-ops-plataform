import { Button, EmptyState, ErrorState, Loading, useAsync } from "@eops/ui";
import { formatDateTime } from "@eops/shared";
import { notificationService } from "../services/notificationService";
import styles from "../styles/notifications.module.css";
export function NotificationListPage() {
  const { data, loading, error, reload } = useAsync(notificationService.list, []);
  async function read(id: string) { await notificationService.read(id); reload(); }
  async function readAll() { await notificationService.readAll(); reload(); }
  return <section className={styles.page}><header><div><span>SISTEMA</span><h1>Notificações</h1><p>{data?.unread ?? 0} não lidas</p></div><Button disabled={!data?.unread} onClick={() => void readAll()}>Marcar todas como lidas</Button></header>{loading && <Loading />}{error && <ErrorState error={error} onRetry={reload} />}{data?.items.length === 0 && <EmptyState title="Sem notificações" description="Os eventos operacionais aparecerão aqui." />}<ul className={styles.list}>{data?.items.map((item) => <li key={item.id} className={item.readAt ? styles.read : styles.unread}><button onClick={() => void read(item.id)}><i data-type={item.type} /><div><strong>{item.title}</strong><p>{item.message}</p><time>{formatDateTime(item.createdAt)}</time></div></button></li>)}</ul></section>;
}
