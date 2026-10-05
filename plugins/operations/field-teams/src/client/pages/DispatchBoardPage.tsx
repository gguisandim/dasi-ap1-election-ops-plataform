import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Loading,
  Select,
  useAsync,
} from "@eops/ui";
import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type {
  FieldDispatchStatus,
  FieldDispatchSummary,
} from "@eops/shared/workforce";
import { FieldNav } from "../components/FieldNav";
import { fieldTeamsService } from "../services/fieldTeamsService";
import {
  DISPATCH_PRIORITIES,
  DISPATCH_PRIORITY_LABELS,
  DISPATCH_STATUS_LABELS,
  formatDuration,
} from "../status";
import styles from "../styles/fieldTeams.module.css";

const BOARD_COLUMNS: Array<{
  title: string;
  statuses: FieldDispatchStatus[];
}> = [
  { title: "Solicitado", statuses: ["REQUESTED"] },
  { title: "Despachado", statuses: ["DISPATCHED", "ACCEPTED"] },
  { title: "Em deslocamento", statuses: ["EN_ROUTE"] },
  { title: "No local", statuses: ["ARRIVED"] },
  { title: "Em atendimento", statuses: ["IN_PROGRESS"] },
];

const emptyForm = {
  teamId: "",
  memberId: "",
  taskId: "",
  title: "",
  priority: "MEDIUM",
  notes: "",
};

export function DispatchBoardPage() {
  const [params] = useSearchParams();
  const [status, setStatus] = useState("");
  const [teamId, setTeamId] = useState("");
  const [showForm, setShowForm] = useState(Boolean(params.get("taskId")));
  const [form, setForm] = useState({
    ...emptyForm,
    taskId: params.get("taskId") ?? "",
  });
  const [specialtyIds, setSpecialtyIds] = useState<string[]>([]);
  const [error, setError] = useState<Error>();

  const dispatches = useAsync(
    () =>
      fieldTeamsService.dispatches({
        status: (status || undefined) as FieldDispatchStatus | undefined,
        teamId: teamId || undefined,
      }),
    [status, teamId],
  );
  const teams = useAsync(() => fieldTeamsService.teams(), []);
  const members = useAsync(
    () => fieldTeamsService.members({ teamId: form.teamId || undefined }),
    [form.teamId],
  );
  const tasks = useAsync(() => fieldTeamsService.taskOptions(), [showForm]);
  const specialties = useAsync(() => fieldTeamsService.specialties(), [showForm]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(undefined);
    try {
      await fieldTeamsService.createDispatch({
        teamId: form.teamId,
        memberId: form.memberId || undefined,
        taskId: form.taskId || undefined,
        title: form.taskId ? undefined : form.title || undefined,
        priority: form.priority as (typeof DISPATCH_PRIORITIES)[number],
        notes: form.notes || undefined,
        requiredSpecialtyIds: specialtyIds.length ? specialtyIds : undefined,
      });
      setForm({ ...emptyForm });
      setSpecialtyIds([]);
      setShowForm(false);
      dispatches.reload();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason
          : new Error("Não foi possível solicitar o dispatch."),
      );
    }
  }

  const items: FieldDispatchSummary[] = dispatches.data ?? [];
  const active = items.filter(
    (item) =>
      !["COMPLETED", "REJECTED", "CANCELLED"].includes(item.status),
  );
  const finished = items
    .filter((item) => ["COMPLETED", "REJECTED", "CANCELLED"].includes(item.status))
    .sort((first, second) =>
      second.requestedAt.localeCompare(first.requestedAt),
    )
    .slice(0, 20);

  return (
    <section className={styles.page}>
      <FieldNav />
      <header className={styles.header}>
        <div>
          <span>OPERAÇÃO DE CAMPO</span>
          <h1>Despachos</h1>
          <p>
            Quem foi enviado, em que ponto do lifecycle está e qual foi o
            resultado.
          </p>
        </div>
        <Button type="button" onClick={() => setShowForm((value) => !value)}>
          {showForm ? "Fechar solicitação" : "Novo despacho"}
        </Button>
      </header>
      {error && <ErrorState error={error} />}
      {showForm && (
        <Card>
          <h2>Solicitar despacho</h2>
          <form className={styles.form} onSubmit={(event) => void submit(event)}>
            <Field label="Equipe">
              <Select
                required
                value={form.teamId}
                onChange={(event) =>
                  setForm((value) => ({
                    ...value,
                    teamId: event.target.value,
                    memberId: "",
                  }))
                }
              >
                <option value="">Selecione a equipe</option>
                {teams.data?.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.code} · {team.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Responsável individual (opcional)">
              <Select
                disabled={!form.teamId}
                value={form.memberId}
                onChange={(event) =>
                  setForm((value) => ({ ...value, memberId: event.target.value }))
                }
              >
                <option value="">Equipe inteira</option>
                {members.data?.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Tarefa vinculada (opcional)">
              <Select
                value={form.taskId}
                onChange={(event) =>
                  setForm((value) => ({ ...value, taskId: event.target.value }))
                }
              >
                <option value="">Sem tarefa vinculada</option>
                {tasks.data?.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.title}
                  </option>
                ))}
              </Select>
            </Field>
            {!form.taskId && (
              <Field label="Demanda">
                <Input
                  required
                  value={form.title}
                  placeholder="Ex.: apoio ao local 1234"
                  onChange={(event) =>
                    setForm((value) => ({ ...value, title: event.target.value }))
                  }
                />
              </Field>
            )}
            <Field label="Prioridade">
              <Select
                value={form.priority}
                onChange={(event) =>
                  setForm((value) => ({ ...value, priority: event.target.value }))
                }
              >
                {DISPATCH_PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>
                    {DISPATCH_PRIORITY_LABELS[priority]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Especialidades exigidas (opcional)">
              <Select
                multiple
                value={specialtyIds}
                onChange={(event) =>
                  setSpecialtyIds(
                    [...event.target.selectedOptions].map(
                      (option) => option.value,
                    ),
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
            <Field label="Observações">
              <Input
                value={form.notes}
                onChange={(event) =>
                  setForm((value) => ({ ...value, notes: event.target.value }))
                }
              />
            </Field>
            <Button type="submit">Solicitar despacho</Button>
          </form>
        </Card>
      )}
      <Card>
        <div className={styles.filters}>
          <Field label="Status">
            <Select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="">Todos os status</option>
              {Object.entries(DISPATCH_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Equipe">
            <Select
              value={teamId}
              onChange={(event) => setTeamId(event.target.value)}
            >
              <option value="">Todas as equipes</option>
              {teams.data?.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.code} · {team.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Card>
      {dispatches.loading && <Loading label="Carregando despachos…" />}
      {dispatches.error && (
        <ErrorState error={dispatches.error} onRetry={dispatches.reload} />
      )}
      {dispatches.data && !items.length && (
        <EmptyState
          title="Nenhum despacho registrado"
          description="Solicite um despacho para enviar uma equipe a uma demanda operacional."
        />
      )}
      {!!active.length && (
        <div className={styles.board}>
          {BOARD_COLUMNS.map((column) => {
            const columnItems = active.filter((item) =>
              column.statuses.includes(item.status),
            );
            return (
              <section className={styles.boardColumn} key={column.title}>
                <header>
                  <h3>{column.title}</h3>
                  <Badge tone={columnItems.length ? "neutral" : "warning"}>
                    {columnItems.length}
                  </Badge>
                </header>
                {columnItems.map((item) => (
                  <Link
                    className={styles.boardCard}
                    key={item.id}
                    to={`/field-teams/dispatch/${item.id}`}
                  >
                    <strong>{item.title}</strong>
                    <span>
                      {item.teamCode} · {DISPATCH_PRIORITY_LABELS[item.priority]}
                    </span>
                    <small>
                      {item.memberName ?? "Equipe inteira"} · há{" "}
                      {formatDuration(item.elapsedMinutes)}
                    </small>
                    {item.specialties.length > 0 && (
                      <small>{item.specialties.join(", ")}</small>
                    )}
                  </Link>
                ))}
                {!columnItems.length && <small>Sem despachos.</small>}
              </section>
            );
          })}
        </div>
      )}
      {!!finished.length && (
        <Card>
          <h2>Encerrados recentemente</h2>
          <div className={styles.list}>
            {finished.map((item) => (
              <Link key={item.id} to={`/field-teams/dispatch/${item.id}`}>
                <div>
                  <strong>{item.title}</strong>
                  <span>
                    {item.teamCode} ·{" "}
                    {new Date(item.requestedAt).toLocaleString("pt-BR")}
                  </span>
                </div>
                <Badge
                  tone={item.status === "COMPLETED" ? "success" : "danger"}
                >
                  {DISPATCH_STATUS_LABELS[item.status]}
                </Badge>
              </Link>
            ))}
          </div>
        </Card>
      )}
    </section>
  );
}
