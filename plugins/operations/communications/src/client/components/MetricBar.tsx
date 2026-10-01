import type { CommunicationMetrics } from "@eops/shared/communications";
import { formatPercent } from "@eops/shared/format";
import styles from "../styles/communications.module.css";

/**
 * Barra segmentada de acompanhamento de leitura.
 *
 * Os quatro segmentos representam estados mutuamente exclusivos do
 * destinatário, portanto sempre somam 100% do total.
 */
export function MetricBar({ metrics }: { metrics: CommunicationMetrics }) {
  if (metrics.total === 0) {
    return <p className={styles.metricEmpty}>Sem destinatários definidos.</p>;
  }
  const share = (value: number) => `${(value / metrics.total) * 100}%`;
  return (
    <div className={styles.metricBar} role="img" aria-label={metricSummary(metrics)}>
      <span className={styles.segmentConfirmed} style={{ width: share(metrics.confirmed) }} />
      <span
        className={styles.segmentViewed}
        style={{ width: share(metrics.viewed - metrics.confirmed) }}
      />
      <span
        className={styles.segmentDelivered}
        style={{ width: share(metrics.delivered - metrics.viewed) }}
      />
      <span className={styles.segmentPending} style={{ width: share(metrics.pending) }} />
    </div>
  );
}

export function metricSummary(metrics: CommunicationMetrics): string {
  return `Leitura ${formatPercent(metrics.readRate)}, confirmação ${formatPercent(metrics.confirmationRate)}, ${metrics.pending} pendente(s)`;
}

export function MetricBarLegend() {
  return (
    <ul className={styles.metricLegend}>
      <li>
        <span className={styles.dotConfirmed} /> Confirmado
      </li>
      <li>
        <span className={styles.dotViewed} /> Lido
      </li>
      <li>
        <span className={styles.dotDelivered} /> Entregue
      </li>
      <li>
        <span className={styles.dotPending} /> Pendente
      </li>
    </ul>
  );
}

/** Indicadores numéricos do comunicado, em grade. */
export function MetricGrid({ metrics }: { metrics: CommunicationMetrics }) {
  const items = [
    { label: "Destinatários", value: metrics.total },
    { label: "Entregues", value: metrics.delivered },
    { label: "Lidos", value: metrics.viewed },
    { label: "Confirmados", value: metrics.confirmed },
    { label: "Pendentes", value: metrics.pending },
    { label: "Taxa de leitura", value: formatPercent(metrics.readRate) },
    { label: "Taxa de confirmação", value: formatPercent(metrics.confirmationRate) },
  ];
  return (
    <div className={styles.metricGrid}>
      {items.map((item) => (
        <div key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </div>
      ))}
    </div>
  );
}
