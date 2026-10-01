import { Link } from "react-router-dom";
import { formatDate } from "@eops/shared/format";
import { RISK_SCALE_LABELS, type RiskSummary } from "@eops/shared/risks";
import { RiskChip, RiskLevelBadge, RiskStatusBadge } from "./RiskBadges";
import styles from "../styles/risk.module.css";
import { progressLabel } from "../utils/presentation";

export function RiskCard({ risk }: { risk: RiskSummary }) {
  return (
    <article
      className={`${styles.card} ${risk.level === "CRITICAL" ? styles.cardCritical : ""}`}
    >
      <header>
        <span className={styles.code}>{risk.code}</span>
        <RiskLevelBadge level={risk.level} score={risk.score} />
      </header>
      <h3>
        <Link to={`/risks/${risk.id}`}>{risk.title}</Link>
      </h3>
      <p className={styles.clamp}>{risk.description}</p>
      <div className={styles.cardBadges}>
        <RiskStatusBadge status={risk.status} />
        <RiskChip label={risk.category?.name ?? "Sem categoria"} />
        <RiskChip
          label={`${RISK_SCALE_LABELS[risk.probability]} × ${RISK_SCALE_LABELS[risk.impact]}`}
        />
        {risk.mitigationCount === 0 && <RiskChip label="sem mitigação" icon="!" />}
        {risk.hasOverdueMitigation && <RiskChip label="ação atrasada" icon="!" />}
      </div>
      <footer>
        <span>Proprietário: {risk.ownerName}</span>
        <span>
          {risk.mitigationCount > 0
            ? `Mitigação ${progressLabel(risk.mitigationProgress)}`
            : "Sem plano de mitigação"}
        </span>
        {risk.dueDate && (
          <span className={risk.overdue ? styles.dangerText : undefined}>
            Prazo {formatDate(risk.dueDate)}
            {risk.overdue && " · vencido"}
          </span>
        )}
      </footer>
    </article>
  );
}
