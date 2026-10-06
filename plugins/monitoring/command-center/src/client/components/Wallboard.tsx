import { Loading } from "@eops/ui";
import { formatDateTime } from "@eops/shared/format";
import type {
  OperationalAttentionItem,
  OperationalSummary,
  OperationalZoneSituation,
} from "@eops/shared/command-center";
import { Link } from "react-router-dom";
import { formatAge } from "../services/commandCenterService";
import { OperationalHealthBanner } from "./OperationalHealthBanner";
import styles from "../styles/command-center.module.css";

function borderClass(item: OperationalAttentionItem) {
  if (item.severity === "CRITICAL" || item.deadlineState === "OVERDUE")
    return styles.borderCritical;
  return styles.borderWarning;
}

/**
 * Modo wallboard: sem formulários, sem filtros, alta densidade e auto-refresh.
 * O polling é responsabilidade da página que hospeda este componente.
 */
export function Wallboard({
  summary,
  zones,
  refreshing,
}: {
  summary: OperationalSummary;
  zones: OperationalZoneSituation[];
  refreshing: boolean;
}) {
  const feed = [...summary.criticalItems, ...summary.warnings].slice(0, 12);
  return (
    <div className={styles.wallboard}>
      <OperationalHealthBanner
        health={summary.health}
        metrics={summary.metrics}
      />
      <div className={styles.wallboardGrid}>
        <section className={styles.wallboardCard}>
          <h2>Zonas mais críticas</h2>
          {zones.length === 0 ? (
            <p className={styles.muted}>Nenhuma zona no escopo.</p>
          ) : (
            <ul className={styles.wallboardFeed}>
              {zones.slice(0, 8).map((zone) => (
                <li
                  key={zone.zoneId}
                  className={
                    zone.health === "CRITICAL"
                      ? styles.borderCritical
                      : zone.health === "ATTENTION"
                        ? styles.borderWarning
                        : ""
                  }
                >
                  <strong>
                    {zone.zoneNumber} · {zone.zoneName}
                  </strong>
                  <span>
                    {zone.criticalItemCount} crítico(s) · {zone.itemCount} sinal(is)
                    · {zone.municipality}/{zone.state}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className={styles.wallboardCard}>
          <h2>Atenção agora</h2>
          {feed.length === 0 ? (
            <p className={styles.muted}>Sem sinais operacionais no momento.</p>
          ) : (
            <ul className={styles.wallboardFeed}>
              {feed.map((item) => (
                <li key={item.id} className={borderClass(item)}>
                  <strong>
                    <Link to={item.deepLink}>{item.title}</Link>
                  </strong>
                  <span>{item.summary}</span>
                  <span>
                    {item.status} · há {formatAge(item.ageSeconds)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <footer className={styles.wallboardFooter}>
        <span>Gerado em {formatDateTime(summary.generatedAt)}</span>
        <span>
          {refreshing ? (
            <>
              <Loading label="Atualizando painel…" />
            </>
          ) : (
            "Atualização automática ativa"
          )}
        </span>
      </footer>
    </div>
  );
}
