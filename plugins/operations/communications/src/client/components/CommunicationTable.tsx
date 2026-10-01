import { Link } from "react-router-dom";
import { formatDateTime, formatPercent } from "@eops/shared/format";
import type { CommunicationSummary } from "@eops/shared/communications";
import { PriorityBadge, StatusBadge } from "./CommunicationBadges";
import { MetricBar } from "./MetricBar";
import styles from "../styles/communications.module.css";
import { describeExpiration } from "../utils/presentation";

/**
 * Tabela de comunicados.
 *
 * A coluna de acompanhamento mostra a barra segmentada — é o indicador que a
 * coordenação usa para decidir se precisa cobrar confirmações.
 */
export function CommunicationTable({ items }: { items: CommunicationSummary[] }) {
  return (
    <div className={styles.tableWrap}>
      <table>
        <thead>
          <tr>
            <th>Código</th>
            <th>Comunicado</th>
            <th>Prioridade</th>
            <th>Status</th>
            <th>Público</th>
            <th>Publicação</th>
            <th>Validade</th>
            <th>Acompanhamento</th>
          </tr>
        </thead>
        <tbody>
          {items.map((communication) => {
            const expiration = describeExpiration(communication.expiresAt);
            return (
              <tr
                key={communication.id}
                className={communication.urgent ? styles.urgentRow : undefined}
              >
                <td>
                  <Link to={`/communications/messages/${communication.id}`}>
                    {communication.code}
                  </Link>
                </td>
                <td>
                  <strong>{communication.title}</strong>
                  <small>
                    {communication.category?.name ?? "Sem categoria"} ·{" "}
                    {communication.authorName}
                  </small>
                </td>
                <td>
                  <PriorityBadge priority={communication.priority} />
                </td>
                <td>
                  <StatusBadge status={communication.status} />
                </td>
                <td>
                  {communication.audiences.length} regra(s)
                  <small>{communication.recipientCount} destinatário(s)</small>
                </td>
                <td>
                  {communication.publishedAt
                    ? formatDateTime(communication.publishedAt)
                    : "—"}
                </td>
                <td className={communication.expired ? styles.dangerText : undefined}>
                  {expiration ?? "Sem prazo"}
                </td>
                <td className={styles.trackingCell}>
                  {communication.metrics ? (
                    <>
                      <MetricBar metrics={communication.metrics} />
                      <small>
                        {communication.metrics.confirmed} confirmado(s) ·{" "}
                        {formatPercent(communication.metrics.confirmationRate)}
                      </small>
                    </>
                  ) : (
                    <span className={styles.mutedText}>—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
