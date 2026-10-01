import { useAsync } from "@eops/ui";
import { Link } from "react-router-dom";
import { notificationService } from "../services/notificationService";
import styles from "../styles/notifications.module.css";
export function NotificationBell() { const { data } = useAsync(notificationService.list, []); return <Link className={styles.bell} to="/notifications" aria-label={`${data?.unread ?? 0} notificações não lidas`}><span>●</span>{Boolean(data?.unread) && <b>{data!.unread}</b>}</Link>; }
