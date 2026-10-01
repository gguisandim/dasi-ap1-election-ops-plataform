import { Card } from "@eops/ui";
import { formatPercent } from "@eops/shared/format";
import type { EvidenceDashboard, EvidenceType } from "@eops/shared/evidence";
import { EVIDENCE_TYPE_LABELS } from "@eops/shared/evidence";
import styles from "../styles/evidence.module.css";
import { formatBytes } from "../utils/format";

function share(part: number, total: number): number {
  return total <= 0 ? 0 : Math.round((part / total) * 1000) / 10;
}

/**
 * Cartões do acervo: volume, cobertura de vínculo e distribuição por tipo.
 * A cobertura de vínculo é o indicador de qualidade do repositório — evidência
 * sem vínculo é evidência que ninguém vai encontrar.
 */
export function EvidenceSummaryCards({ dashboard }: { dashboard: EvidenceDashboard }) {
  const linked = share(dashboard.withLinks, dashboard.total);
  const topTypes = [...dashboard.byType].sort((a, b) => b.total - a.total).slice(0, 3);

  return (
    <div className={styles.summaryCards}>
      <Card className={styles.summaryCard}>
        <span>Evidências</span>
        <strong>{dashboard.total}</strong>
        <small>
          {dashboard.active} ativa(s) · {dashboard.archived} arquivada(s)
        </small>
      </Card>
      <Card className={styles.summaryCard}>
        <span>Vinculadas</span>
        <strong>{formatPercent(linked)}</strong>
        <small>{dashboard.withoutLinks} sem vínculo operacional</small>
      </Card>
      <Card className={styles.summaryCard}>
        <span>Volume armazenado</span>
        <strong>{formatBytes(dashboard.totalBytes)}</strong>
        <small>Somente a versão corrente de cada evidência</small>
      </Card>
      <Card className={styles.summaryCard}>
        <span>Últimos 7 dias</span>
        <strong>{dashboard.addedLastSevenDays}</strong>
        <small>Registros adicionados</small>
      </Card>
      <Card className={styles.summaryCard}>
        <span>Tipos predominantes</span>
        <ul className={styles.miniList}>
          {topTypes.length === 0 && <li className={styles.mutedText}>sem dados</li>}
          {topTypes.map((item) => (
            <li key={item.type}>
              <span>{EVIDENCE_TYPE_LABELS[item.type as EvidenceType]}</span>
              <strong>{item.total}</strong>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
