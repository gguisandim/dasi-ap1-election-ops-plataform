import { useState, type FormEvent } from "react";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Input,
  LinkButton,
  Loading,
  useAsync,
} from "@eops/ui";
import { Link, useParams } from "react-router-dom";
import { FieldNav } from "../components/FieldNav";
import { fieldTeamsService } from "../services/fieldTeamsService";
import { MEMBER_STATUS_LABELS } from "../../types";
import {
  DISPATCH_STATUS_LABELS,
  formatDuration,
} from "../status";
import styles from "../styles/fieldTeams.module.css";

export function MemberDetailPage() {
  const { id = "" } = useParams();
  const member = useAsync(() => fieldTeamsService.member(id), [id]);
  const now = new Date();
  const shifts = useAsync(
    () =>
      fieldTeamsService.upcomingShifts({
        memberId: id,
        startsFrom: now.toISOString(),
        startsTo: new Date(now.getTime() + 30 * 86400000).toISOString(),
      }),
    [id],
  );
  const dispatches = useAsync(
    () => fieldTeamsService.dispatches({ memberId: id, active: true }),
    [id],
  );
  const [form, setForm] = useState({
    startsAt: "",
    endsAt: "",
    reason: "",
    notes: "",
  });
  const [error, setError] = useState<Error>();
  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      await fieldTeamsService.createUnavailability(id, {
        ...form,
        startsAt: new Date(form.startsAt).toISOString(),
        endsAt: new Date(form.endsAt).toISOString(),
        notes: form.notes || undefined,
      });
      setForm({ startsAt: "", endsAt: "", reason: "", notes: "" });
      member.reload();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason
          : new Error("Falha ao registrar indisponibilidade."),
      );
    }
  }
  if (member.loading) return <Loading label="Carregando membro…" />;
  if (member.error || !member.data)
    return (
      <ErrorState
        error={member.error ?? new Error("Membro não encontrado.")}
      />
    );
  const data = member.data;
  return (
    <section className={styles.page}>
      <FieldNav />
      <header className={styles.header}>
        <div>
          <span>MEMBRO</span>
          <h1>{data.name}</h1>
          <p>
            {data.team?.name} · {data.role.name}
          </p>
        </div>
        <LinkButton to={"/shifts/list?memberId=" + data.id}>
          Ver todos os turnos
        </LinkButton>
      </header>
      {error && <ErrorState error={error} />}
      <div className={styles.metrics}>
        <Card>
          <span>Disponibilidade base</span>
          <strong>{MEMBER_STATUS_LABELS[data.status]}</strong>
        </Card>
        <Card>
          <span>Especialidades</span>
          <strong>{data.specialties.length}</strong>
        </Card>
        <Card>
          <span>Indisponibilidades</span>
          <strong>{data.unavailability.length}</strong>
        </Card>
        <Card>
          <span>Próximos turnos</span>
          <strong>{shifts.data?.length ?? 0}</strong>
        </Card>
      </div>
      <div className={styles.columns}>
        <Card>
          <h2>Nova indisponibilidade</h2>
          <form
            className={styles.form}
            onSubmit={(event) => void submit(event)}
          >
            <Field label="Início">
              <Input
                required
                type="datetime-local"
                value={form.startsAt}
                onChange={(event) =>
                  setForm((value) => ({
                    ...value,
                    startsAt: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="Fim">
              <Input
                required
                type="datetime-local"
                value={form.endsAt}
                onChange={(event) =>
                  setForm((value) => ({ ...value, endsAt: event.target.value }))
                }
              />
            </Field>
            <Field label="Motivo">
              <Input
                required
                value={form.reason}
                onChange={(event) =>
                  setForm((value) => ({ ...value, reason: event.target.value }))
                }
              />
            </Field>
            <Field label="Observação">
              <Input
                value={form.notes}
                onChange={(event) =>
                  setForm((value) => ({ ...value, notes: event.target.value }))
                }
              />
            </Field>
            <Button type="submit">Registrar período</Button>
          </form>
        </Card>
        <Card>
          <h2>Especialidades e contato</h2>
          <p>
            {data.specialties.map((item) => item.specialty.name).join(", ") ||
              "Sem especialidades cadastradas"}
          </p>
          <p>
            {data.phone || "Sem telefone"} · {data.email || "Sem e-mail"}
          </p>
          <Badge
            tone={
              data.status === "UNAVAILABLE" || data.status === "OFF_DUTY"
                ? "danger"
                : data.status === "ON_DUTY"
                  ? "success"
                  : "neutral"
            }
          >
            {MEMBER_STATUS_LABELS[data.status]}
          </Badge>
        </Card>
      </div>
      <Card>
        <h2>Períodos de indisponibilidade</h2>
        {!data.unavailability.length && (
          <EmptyState
            title="Nenhum período registrado"
            description="O membro não possui indisponibilidades operacionais."
          />
        )}
        <div className={styles.list}>
          {data.unavailability.map((period) => (
            <article key={period.id}>
              <div>
                <strong>{period.reason}</strong>
                <span>
                  {new Date(period.startsAt).toLocaleString("pt-BR")} →{" "}
                  {new Date(period.endsAt).toLocaleString("pt-BR")}
                </span>
                <small>{period.notes}</small>
              </div>
              <Button
                onClick={() =>
                  void fieldTeamsService
                    .removeUnavailability(id, period.id)
                    .then(() => member.reload())
                }
              >
                Remover
              </Button>
            </article>
          ))}
        </div>
      </Card>
      <Card>
        <h2>Despacho atual</h2>
        {dispatches.loading && <Loading />}
        {dispatches.error && (
          <ErrorState error={dispatches.error} onRetry={dispatches.reload} />
        )}
        {dispatches.data?.length === 0 && (
          <p className={styles.muted}>
            O membro não possui dispatch ativo no momento.
          </p>
        )}
        <div className={styles.list}>
          {dispatches.data?.map((item) => (
            <Link key={item.id} to={`/field-teams/dispatch/${item.id}`}>
              <div>
                <strong>{item.title}</strong>
                <span>
                  {DISPATCH_STATUS_LABELS[item.status]} · {item.teamCode} · há{" "}
                  {formatDuration(item.elapsedMinutes)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </Card>
      <Card>
        <h2>Próximos turnos</h2>
        {shifts.loading && <Loading />}
        {shifts.error && (
          <ErrorState error={shifts.error} onRetry={shifts.reload} />
        )}
        {shifts.data?.length === 0 && (
          <EmptyState
            title="Sem próximos turnos"
            description="Assignments são geridos pelo módulo Shifts."
          />
        )}
        <div className={styles.schedule}>
          {shifts.data?.map((shift) => (
            <article key={shift.id}>
              <time>{new Date(shift.startsAt).toLocaleString("pt-BR")}</time>
              <div>
                <strong>{shift.name}</strong>
                <span>
                  {shift.status} · {shift.coverage.state}
                </span>
              </div>
            </article>
          ))}
        </div>
      </Card>
    </section>
  );
}
