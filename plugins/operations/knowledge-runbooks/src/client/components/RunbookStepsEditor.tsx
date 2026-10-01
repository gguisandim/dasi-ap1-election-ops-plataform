import { Button, Field, Input } from "@eops/ui";
import type { RunbookStepInput } from "@eops/shared/knowledge";
import styles from "../styles/knowledge.module.css";

const emptyStep = (order: number): RunbookStepInput => ({
  order,
  title: "",
  instruction: "",
  expected: "",
  required: true,
  warning: "",
  notes: "",
});

/**
 * Editor de passos ordenados.
 *
 * Passos são registros próprios, não um texto corrido: isso permite marcar
 * obrigatoriedade, destacar alerta e medir quantos passos foram cumpridos na
 * execução. A ordem é renumerada a partir de 1 e ajustada ao mover.
 */
export function RunbookStepsEditor({
  value,
  onChange,
}: {
  value: RunbookStepInput[];
  onChange: (steps: RunbookStepInput[]) => void;
}) {
  const renumber = (steps: RunbookStepInput[]) =>
    steps.map((step, index) => ({ ...step, order: index + 1 }));

  const add = () => onChange([...value, emptyStep(value.length + 1)]);

  const update = (index: number, patch: Partial<RunbookStepInput>) =>
    onChange(value.map((step, position) => (position === index ? { ...step, ...patch } : step)));

  const remove = (index: number) =>
    onChange(renumber(value.filter((_, position) => position !== index)));

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(renumber(next));
  };

  return (
    <div className={styles.stepsEditor}>
      <div className={styles.sectionTitle}>
        <h2>Passos do runbook</h2>
        <small className={styles.mutedText}>
          A ordem é a sequência de execução. Passos opcionais não bloqueiam a conclusão.
        </small>
        <Button type="button" onClick={add}>
          Adicionar passo
        </Button>
      </div>

      {value.length === 0 && (
        <p className={styles.mutedText}>
          Nenhum passo definido. Um runbook precisa de ao menos um passo para ser publicado.
        </p>
      )}

      {value.map((step, index) => (
        <div className={styles.stepEditor} key={index}>
          <div className={styles.stepHeader}>
            <strong className={styles.stepOrder}>{index + 1}</strong>
            <Input
              aria-label={`Título do passo ${index + 1}`}
              placeholder="Título do passo"
              value={step.title}
              onChange={(event) => update(index, { title: event.target.value })}
            />
            <Button type="button" onClick={() => move(index, -1)} disabled={index === 0}>
              ↑
            </Button>
            <Button
              type="button"
              onClick={() => move(index, 1)}
              disabled={index === value.length - 1}
            >
              ↓
            </Button>
            <Button type="button" onClick={() => remove(index)}>
              Remover
            </Button>
          </div>

          <Field label="Instrução">
            <textarea
              className={styles.textareaSmall}
              placeholder="O que exatamente deve ser feito"
              value={step.instruction}
              onChange={(event) => update(index, { instruction: event.target.value })}
            />
          </Field>

          <div className={styles.stepGrid}>
            <Field label="Resultado esperado">
              <Input
                value={step.expected ?? ""}
                onChange={(event) => update(index, { expected: event.target.value })}
              />
            </Field>
            <Field label="Alerta (opcional)">
              <Input
                value={step.warning ?? ""}
                onChange={(event) => update(index, { warning: event.target.value })}
              />
            </Field>
            <Field label="Observações">
              <Input
                value={step.notes ?? ""}
                onChange={(event) => update(index, { notes: event.target.value })}
              />
            </Field>
            <label className={styles.checkbox}>
              <input
                type="checkbox"
                checked={step.required ?? true}
                onChange={(event) => update(index, { required: event.target.checked })}
              />
              Passo obrigatório
            </label>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Lista somente-leitura, usada no detalhe e durante a execução. */
export function RunbookStepList({
  steps,
  completed,
  onToggle,
}: {
  steps: Array<{
    id: string;
    order: number;
    title: string;
    instruction: string;
    expected: string | null;
    required: boolean;
    warning: string | null;
    notes: string | null;
  }>;
  completed?: number[];
  onToggle?: (order: number) => void;
}) {
  if (steps.length === 0) {
    return <p className={styles.mutedText}>Nenhum passo registrado.</p>;
  }
  return (
    <ol className={styles.stepList}>
      {steps.map((step) => {
        const done = completed?.includes(step.order) ?? false;
        return (
          <li key={step.id} className={done ? styles.stepDone : undefined}>
            <div className={styles.stepListHeader}>
              {onToggle && (
                <input
                  type="checkbox"
                  aria-label={`Marcar passo ${step.order} como concluído`}
                  checked={done}
                  onChange={() => onToggle(step.order)}
                />
              )}
              <strong>
                {step.order}. {step.title}
              </strong>
              {!step.required && <span className={styles.chip}>opcional</span>}
            </div>
            <p>{step.instruction}</p>
            {step.expected && (
              <small className={styles.expected}>Resultado esperado: {step.expected}</small>
            )}
            {step.warning && <small className={styles.dangerText}>Atenção: {step.warning}</small>}
            {step.notes && <small className={styles.mutedText}>{step.notes}</small>}
          </li>
        );
      })}
    </ol>
  );
}
