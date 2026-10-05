import {
  Badge,
  Button,
  Field,
  Input,
  LinkButton,
  Loading,
  Select,
  useAsync,
} from "@eops/ui";
import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import type {
  Task,
  TaskExecutionMode,
} from "../../types";
import { tasksService } from "../services/tasksService";
import styles from "../styles/tasks.module.css";

export const TASK_EXECUTION_MODES: TaskExecutionMode[] = [
  "OFFICE",
  "FIELD",
  "MIXED",
];

export const TASK_EXECUTION_MODE_LABELS: Record<TaskExecutionMode, string> = {
  OFFICE: "Escritório",
  FIELD: "Campo",
  MIXED: "Misto",
};

const DISPATCH_STATUS_LABELS: Record<string, string> = {
  REQUESTED: "Solicitado",
  DISPATCHED: "Despachado",
  ACCEPTED: "Aceito",
  EN_ROUTE: "Em deslocamento",
  ARRIVED: "No local",
  IN_PROGRESS: "Em atendimento",
  COMPLETED: "Concluído",
  REJECTED: "Rejeitado",
  CANCELLED: "Cancelado",
};

function formatElapsed(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}min`;
}

export function TaskFieldExecution({
  task,
  onSaved,
}: {
  task: Task;
  onSaved: () => Promise<void> | void;
}) {
  const [executionMode, setExecutionMode] = useState<TaskExecutionMode>(
    task.executionMode,
  );
  const [requiredTeamSize, setRequiredTeamSize] = useState(
    task.requiredTeamSize ? String(task.requiredTeamSize) : "",
  );
  const [specialtyIds, setSpecialtyIds] = useState<string[]>(
    task.specialtyRequirements.map((item) => item.specialtyId),
  );
  const [error, setError] = useState<Error>();
  const specialties = useAsync(tasksService.fieldSpecialties, []);
  const dispatches = useAsync(() => tasksService.taskDispatches(task.id), [
    task.id,
  ]);
  useEffect(() => {
    setExecutionMode(task.executionMode);
    setRequiredTeamSize(task.requiredTeamSize ? String(task.requiredTeamSize) : "");
    setSpecialtyIds(task.specialtyRequirements.map((item) => item.specialtyId));
  }, [task]);

  async function save(event: FormEvent) {
    event.preventDefault();
    setError(undefined);
    try {
      await tasksService.update(task.id, {
        executionMode,
        requiredTeamSize: requiredTeamSize ? Number(requiredTeamSize) : null,
        requiredSpecialtyIds: specialtyIds,
      });
      await onSaved();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason
          : new Error("Não foi possível salvar os requisitos de campo."),
      );
    }
  }

  const isFieldWork = executionMode !== "OFFICE";
  return (
    <>
      <section className={styles.detailPanel}>
        <div className={styles.sectionHeading}>
          <h2>Execução em campo</h2>
          <Badge tone={isFieldWork ? "success" : "neutral"}>
            {TASK_EXECUTION_MODE_LABELS[executionMode]}
          </Badge>
        </div>
        {error && <p className={styles.inlineError}>{error.message}</p>}
        <form className={styles.detailFields} onSubmit={(event) => void save(event)}>
          <Field label="Modo de execução">
            <Select
              value={executionMode}
              onChange={(event) =>
                setExecutionMode(event.target.value as TaskExecutionMode)
              }
            >
              {TASK_EXECUTION_MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {TASK_EXECUTION_MODE_LABELS[mode]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Tamanho mínimo da equipe">
            <Input
              type="number"
              min={1}
              value={requiredTeamSize}
              onChange={(event) => setRequiredTeamSize(event.target.value)}
            />
          </Field>
          <Field label="Especialidades exigidas">
            <Select
              multiple
              value={specialtyIds}
              onChange={(event) =>
                setSpecialtyIds(
                  [...event.target.selectedOptions].map((option) => option.value),
                )
              }
            >
              {specialties.data?.map((specialty) => (
                <option key={specialty.id} value={specialty.id}>
                  {specialty.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className={styles.formActions}>
            <Button type="submit">Salvar requisitos</Button>
          </div>
        </form>
        <p className={styles.muted}>
          Requisitos de campo reutilizam o catálogo de especialidades de Field
          Teams e alimentam o capability match do despacho.
        </p>
      </section>
      <section className={styles.detailPanel}>
        <div className={styles.sectionHeading}>
          <h2>Despacho vinculado</h2>
          <Badge>{dispatches.data?.length ?? 0}</Badge>
        </div>
        {dispatches.loading && <Loading />}
        {dispatches.error && (
          <p className={styles.inlineError}>{dispatches.error.message}</p>
        )}
        {dispatches.data?.length === 0 && (
          <p className={styles.muted}>
            Esta tarefa ainda não originou um despacho de campo.
          </p>
        )}
        <div className={styles.dependencyList}>
          {dispatches.data?.map((item) => (
            <div className={styles.dependencyRow} key={item.id}>
              <div>
                <Link to={`/field-teams/dispatch/${item.id}`}>
                  {item.teamCode} · {item.title}
                </Link>
                <small>
                  {DISPATCH_STATUS_LABELS[item.status] ?? item.status} ·{" "}
                  {item.memberName ?? "Equipe inteira"} · há{" "}
                  {formatElapsed(item.elapsedMinutes)}
                </small>
              </div>
            </div>
          ))}
        </div>
        {isFieldWork && (
          <div className={styles.formActions}>
            <LinkButton to={`/field-teams/dispatch?taskId=${task.id}`}>
              Solicitar despacho
            </LinkButton>
          </div>
        )}
      </section>
    </>
  );
}
