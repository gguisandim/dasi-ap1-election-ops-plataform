import {
  OPERATIONAL_HEALTH_LABELS,
  type OperationalHealth,
  type OperationalMetrics,
} from "@eops/shared/command-center";
import styles from "../styles/command-center.module.css";

const bannerClass: Record<OperationalHealth, string> = {
  NORMAL: styles.healthNormal,
  ATTENTION: styles.healthAttention,
  CRITICAL: styles.healthCritical,
};

function metric(value: number | null, label: string) {
  return (
    <li>
      <span>{label}</span>
      <strong>{value === null ? "indisponível" : value}</strong>
    </li>
  );
}

export function OperationalHealthBanner({
  health,
  metrics,
}: {
  health: OperationalHealth;
  metrics: OperationalMetrics;
}) {
  return (
    <section className={`${styles.healthBanner} ${bannerClass[health]}`}>
      <div>
        <span className={styles.healthLabel}>Estado operacional</span>
        <strong className={styles.healthValue}>
          {OPERATIONAL_HEALTH_LABELS[health]}
        </strong>
      </div>
      <ul className={styles.healthMeta}>
        {metric(metrics.criticalItems, "Itens críticos")}
        {metric(metrics.totalItems, "Itens monitorados")}
        {metric(metrics.activeIncidents, "Incidentes ativos")}
        {metric(metrics.pendingHandovers, "Passagens pendentes")}
        {metric(metrics.resourceRequestsCritical, "Recursos críticos")}
      </ul>
    </section>
  );
}
