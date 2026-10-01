import { Select } from "@eops/ui";
import { RUNBOOK_OUTCOME_LABELS, RUNBOOK_OUTCOMES } from "@eops/shared/knowledge";
import type { UsageInput } from "../services/knowledgeService";
import styles from "../styles/knowledge.module.css";
import { progressTone } from "../utils/presentation";

/**
 * Progresso da execução.
 *
 * O avanço é calculado sobre os passos marcados; o desfecho é declarado pelo
 * executor e é o que alimenta a taxa de sucesso do runbook.
 */
export function ExecutionProgress({
  completed,
  total,
  progress,
}: {
  completed: number;
  total: number;
  progress: number;
}) {
  return (
    <div className={styles.executionProgress}>
      <div className={styles.executionBar}>
        <span className={styles[progressTone(progress)]} style={{ width: `${progress}%` }} />
      </div>
      <small>
        {completed} de {total} passo(s) concluído(s) · {progress}%
      </small>
    </div>
  );
}

export function OutcomeSelector({
  value,
  onChange,
}: {
  value: UsageInput["outcome"];
  onChange: (value: UsageInput["outcome"]) => void;
}) {
  return (
    <Select
      aria-label="Resultado da execução"
      value={value}
      onChange={(event) => onChange(event.target.value as UsageInput["outcome"])}
    >
      {RUNBOOK_OUTCOMES.map((outcome) => (
        <option key={outcome} value={outcome}>
          {RUNBOOK_OUTCOME_LABELS[outcome]}
        </option>
      ))}
    </Select>
  );
}
