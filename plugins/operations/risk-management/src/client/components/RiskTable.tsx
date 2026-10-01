import { Link } from "react-router-dom";
import { formatDate } from "@eops/shared/format";
import {
  RISK_SCALE_LABELS,
  type RiskSummary,
} from "@eops/shared/risks";
import { RiskLevelBadge, RiskStatusBadge } from "./RiskBadges";
import styles from "../styles/risk.module.css";
import { progressLabel } from "../utils/presentation";

/**
 * Lista de riscos.
 *
 * As colunas de progresso e atraso são o que distingue um risco "registrado" de um
 * risco efetivamente tratado.
 */
export function RiskTable({ items }: { items: RiskSummary[] }) {
  return (
    <div className={styles.tableWrap}>
      <table>
        <thead>
          <tr>
            <th>Código</th>
            <th>Risco</th>
            <th>Local</th>
            <th>Prob. × Impacto</th>
            <th>Score</th>
            <th>Situação</th>
            <th>Proprietário</th>
            <th>Mitigação</th>
            <th>Prazo</th>
          </tr>
        </thead>
        <tbody>
          {items.map((risk) => (
            <tr
              key={risk.id}
              className={risk.level === "CRITICAL" ? styles.criticalRow : undefined}
            >
              <td>
                <Link to={`/risks/${risk.id}`}>{risk.code}</Link>
              </td>
              <td>
                <strong>{risk.title}</strong>
                <small>{risk.category?.name ?? "Sem categoria"}</small>
              </td>
              <td>
                {risk.pollingPlace?.name ?? risk.electoralZone?.name ?? "—"}
                {risk.pollingPlace && <small>{risk.pollingPlace.city}</small>}
              </td>
              <td>
                <small>
                  {RISK_SCALE_LABELS[risk.probability]} × {RISK_SCALE_LABELS[risk.impact]}
                </small>
              </td>
              <td>
                <RiskLevelBadge level={risk.level} score={risk.score} />
              </td>
              <td>
                <RiskStatusBadge status={risk.status} />
              </td>
              <td>{risk.ownerName}</td>
              <td>
                {risk.mitigationCount === 0 ? (
                  <span className={styles.warningText}>sem plano</span>
                ) : (
                  <>
                    <div className={styles.progressBar}>
                      <span style={{ width: `${risk.mitigationProgress ?? 0}%` }} />
                    </div>
                    <small>
                      {progressLabel(risk.mitigationProgress)} · {risk.mitigationCount} ação(ões)
                    </small>
                    {risk.hasOverdueMitigation && (
                      <small className={styles.dangerText}>ação atrasada</small>
                    )}
                  </>
                )}
              </td>
              <td className={risk.overdue ? styles.dangerText : undefined}>
                {risk.dueDate ? formatDate(risk.dueDate) : "—"}
                {risk.overdue && <small>vencido</small>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
