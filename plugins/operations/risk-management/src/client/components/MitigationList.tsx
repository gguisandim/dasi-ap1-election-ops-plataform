import { type FormEvent } from "react";
import { Button, Field, Input, Select } from "@eops/ui";
import { formatDate } from "@eops/shared/format";
import {
  RISK_MITIGATION_STATUSES,
  RISK_MITIGATION_STATUS_LABELS,
  type RiskMitigationInput,
  type RiskMitigationStatus,
  type RiskMitigationSummary,
} from "@eops/shared/risks";
import styles from "../styles/risk.module.css";

const emptyMitigation = (): RiskMitigationInput => ({
  description: "",
  responsibleName: "",
  dueDate: undefined,
  status: "PLANNED",
  progress: 0,
  evidenceId: undefined,
  evidenceLabel: undefined,
  notes: undefined,
});

/**
 * Editor do plano de mitigação.
 *
 * As ações são substituídas em bloco: a tela envia o plano completo e o backend
 * diferencia o que entrou, saiu e foi concluído para registrar no histórico.
 */
export function MitigationEditor({
  value,
  saving,
  onChange,
  onSubmit,
}: {
  value: RiskMitigationInput[];
  saving: boolean;
  onChange: (mitigations: RiskMitigationInput[]) => void;
  onSubmit: () => void;
}) {
  const update = (index: number, patch: Partial<RiskMitigationInput>) =>
    onChange(value.map((item, position) => (position === index ? { ...item, ...patch } : item)));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <form className={styles.form} onSubmit={submit}>
      <div className={styles.sectionTitle}>
        <h2>Plano de mitigação</h2>
        <small className={styles.mutedText}>
          Cada ação precisa de responsável. Ações com prazo vencido e não concluídas
          aparecem como atrasadas nos indicadores.
        </small>
        <Button type="button" onClick={() => onChange([...value, emptyMitigation()])}>
          Adicionar ação
        </Button>
      </div>

      {value.length === 0 && (
        <p className={styles.warningText}>
          Nenhuma ação cadastrada: este risco entra no indicador "sem mitigação".
        </p>
      )}

      {value.map((mitigation, index) => (
        <div className={styles.mitigationEditor} key={index}>
          <div className={styles.mitigationHeader}>
            <strong className={styles.stepOrder}>{index + 1}</strong>
            <Input
              aria-label={`Descrição da ação ${index + 1}`}
              placeholder="O que será feito"
              value={mitigation.description}
              onChange={(event) => update(index, { description: event.target.value })}
            />
            <Button type="button" onClick={() => onChange(value.filter((_, p) => p !== index))}>
              Remover
            </Button>
          </div>
          <div className={styles.formGrid}>
            <Field label="Responsável">
              <Input
                value={mitigation.responsibleName}
                onChange={(event) => update(index, { responsibleName: event.target.value })}
              />
            </Field>
            <Field label="Prazo">
              <Input
                type="date"
                value={mitigation.dueDate?.slice(0, 10) ?? ""}
                onChange={(event) => update(index, { dueDate: event.target.value || undefined })}
              />
            </Field>
            <Field label="Situação">
              <Select
                value={mitigation.status ?? "PLANNED"}
                onChange={(event) =>
                  update(index, {
                    status: event.target.value as RiskMitigationStatus,
                    progress:
                      event.target.value === "COMPLETED" ? 100 : (mitigation.progress ?? 0),
                  })
                }
              >
                {RISK_MITIGATION_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {RISK_MITIGATION_STATUS_LABELS[status]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Progresso (%)">
              <Input
                type="number"
                min={0}
                max={100}
                value={mitigation.progress ?? 0}
                disabled={mitigation.status === "COMPLETED"}
                onChange={(event) => update(index, { progress: Number(event.target.value) })}
              />
            </Field>
            <Field label="Evidência (ID)">
              <Input
                placeholder="Identificador da evidência"
                value={mitigation.evidenceId ?? ""}
                onChange={(event) => update(index, { evidenceId: event.target.value || undefined })}
              />
            </Field>
            <Field label="Observações">
              <Input
                value={mitigation.notes ?? ""}
                onChange={(event) => update(index, { notes: event.target.value || undefined })}
              />
            </Field>
          </div>
        </div>
      ))}

      <div className={styles.actions}>
        <Button disabled={saving} type="submit">
          {saving ? "Salvando…" : "Salvar plano de mitigação"}
        </Button>
      </div>
    </form>
  );
}

/** Lista somente-leitura das ações, usada no detalhe do risco. */
export function MitigationList({ mitigations }: { mitigations: RiskMitigationSummary[] }) {
  if (mitigations.length === 0) {
    return (
      <p className={styles.warningText}>
        Este risco ainda não tem ação de mitigação registrada.
      </p>
    );
  }
  return (
    <ul className={styles.mitigationList}>
      {mitigations.map((mitigation) => (
        <li key={mitigation.id} className={mitigation.overdue ? styles.mitigationOverdue : undefined}>
          <header>
            <strong>{mitigation.description}</strong>
            <span className={`${styles.badge} ${styles.neutral}`}>
              {RISK_MITIGATION_STATUS_LABELS[mitigation.status]}
            </span>
          </header>
          <div className={styles.progressBar}>
            <span style={{ width: `${mitigation.progress}%` }} />
          </div>
          <footer>
            <span>{mitigation.progress}% concluído</span>
            <span>Responsável: {mitigation.responsibleName}</span>
            <span className={mitigation.overdue ? styles.dangerText : undefined}>
              Prazo: {mitigation.dueDate ? formatDate(mitigation.dueDate) : "sem prazo"}
              {mitigation.overdue && " · atrasada"}
            </span>
          </footer>
          {mitigation.evidenceLabel && (
            <small className={styles.mutedText}>Evidência: {mitigation.evidenceLabel}</small>
          )}
          {mitigation.notes && <small className={styles.mutedText}>{mitigation.notes}</small>}
        </li>
      ))}
    </ul>
  );
}
