import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { notificationService } from "../services/notificationService";
import styles from "../styles/notifications.module.css";

export function NotificationBell() {
  const [count, setCount] = useState(0);
  const refresh = useCallback(() => { void notificationService.unreadCount().then((result) => setCount(result.count)).catch(() => undefined); }, []);
  useEffect(() => { refresh(); const interval = window.setInterval(refresh, 60_000); window.addEventListener("eops:notifications-changed", refresh); return () => { window.clearInterval(interval); window.removeEventListener("eops:notifications-changed", refresh); }; }, [refresh]);
  return <Link className={styles.bell} to="/notifications" aria-label={count ? `${count} notificações não lidas` : "Nenhuma notificação não lida"}><span aria-hidden="true">●</span>{count > 0 && <b>{count > 99 ? "99+" : count}</b>}</Link>;
}
