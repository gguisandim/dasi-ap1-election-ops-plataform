import {
  Badge,
  Button,
  Card,
  ErrorState,
  Field,
  Input,
  Loading,
  Select,
  useAsync,
} from "@eops/ui";
import { FIELD_DISPATCH_TRANSITIONS } from "@eops/shared/workforce";
import type { FieldDispatchStatus } from "@eops/shared/workforce";
import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { FieldNav } from "../components/FieldNav";
import { fieldTeamsService } from "../services/fieldTeamsService";
import {
  DISPATCH_PRIORITY_LABELS,
  DISPATCH_STATUS_LABELS,
  formatDuration,
} from "../status";
import styles from "../styles/fieldTeams.module.css";

const CAPABILITY_LABELS: Record<string, string> = {
  MATCH: "Capability atendida",
  PARTIAL: "Capability parcial",
  NO_MATCH: "Capability não atendida",
};

export function DispatchDetailPage() {
  const { id = "" } = useParams();
  const dispatch = useAsync(() => fieldTeamsService.dispatch(id), [id]);
  const [status, setStatus] = useState("");
  const [reason, setReason] = useState("");
  const [summary, setSummary] = useState("");
  const [memberId, setMemberId] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<Error>();
  const members = useAsync(
    () => fieldTeamsService.members({ teamId: dispatch.data?.teamId }),
    [dispatch.data?.teamId],
  );
  const current = dispatch.data;
  const allowed = current ? FIELD_DISPATCH_TRANSITIONS[current.status] : [];

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!status) return;
    setError(undefined);
    try {
      await fieldTeamsService.updateDispatchStatus(id, {
        status: status as FieldDispatchStatus,
        reason: reason || undefined,
        summary: summary || undefined,
        memberId: status === "DISPATCHED" ? memberId || undefined : undefined,
        notes: notes || undefined,
      });
      setStatus("");
      setReason("");
      setSummary("");
      setMemberId("");
      setNotes("");
      dispatch.reload();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason
          : new Error("Não foi possível aplicar a transição."),
      );
    }
  }

  if (dispatch.loading) return <Loading label="Carregando dispatch…" />;
  if (dispatch.error || !current)
    return <ErrorState error={dispatch.error ?? new Error("Dispatch não encontrado.")} />;

  return (
    <section className={styles.page}>
      <FieldNav />
      <p className={styles.muted}>
        <Link to="/field-teams/dispatch">Despachos</Link> / Detalhes
      </p>
      <header className={styles.header}>
        <div>
          <span>DESPACHO</span>
          <h1>{current.title}</h1>
          <p>
            {current.team.code} · {current.team.name} · solicitado em{" "}
            {new Date(current.requestedAt).toLocaleString("pt-BR")}
          </p>
        </div>
        <div className={styles.actions}>
          <Badge
            tone={
              current.priority === "CRITICAL"
                ? "danger"
                : current.priority === "HIGH"
                  ? "warning"
                  : "neutral"
            }
          >
            {DISPATCH_PRIORITY_LABELS[current.priority]}
          </Badge>
          <Badge tone={current.status === "COMPLETED" ? "success" : "neutral"}>
            {DISPATCH_STATUS_LABELS[current.status]}
          </Badge>
        </div>
      </header>
      {error && <ErrorState error={error} />}
      <Card>
        <h2>Resumo</h2>
        <dl className={styles.kv}>
          <div>
            <dt>Tempo desde a solicitação</dt>
            <dd>{formatDuration(current.elapsedMinutes)}</dd>
          </div>
          <div>
            <dt>Tempo até aceite</dt>
            <dd>{formatDuration(current.metrics.timeToAcceptMinutes)}</dd>
          </div>
          <div>
            <dt>Deslocamento</dt>
            <dd>{formatDuration(current.metrics.travelMinutes)}</dd>
          </div>
          <div>
            <dt>Execução</dt>
            <dd>{formatDuration(current.metrics.executionMinutes)}</dd>
          </div>
          <div>
            <dt>Tempo total</dt>
            <dd>{formatDuration(current.metrics.totalMinutes)}</dd>
          </div>
          <div>
            <dt>Capability</dt>
            <dd>
              {current.capabilityMatch
                ? CAPABILITY_LABELS[current.capabilityMatch]
                : "Não aplicável"}
              {current.capabilityOverrideReason
                ? ` · override: ${current.capabilityOverrideReason}`
                : ""}
            </dd>
          </div>
          <div>
            <dt>Responsável</dt>
            <dd>{current.member?.name ?? "Equipe inteira"}</dd>
          </div>
          <div>
            <dt>Local</dt>
            <dd>
              {current.pollingPlace?.name ??
                current.electoralZone?.name ??
                current.locationLabel ??
                "—"}
            </dd>
          </div>
        </dl>
        {current.notes && <p className={styles.muted}>{current.notes}</p>}
        {current.rejectionReason && (
          <p className={styles.inlineError}>
            Rejeitado: {current.rejectionReason}
          </p>
        )}
        {current.cancellationReason && (
          <p className={styles.inlineError}>
            Cancelado: {current.cancellationReason}
          </p>
        )}
        {current.completionSummary && (
          <p>Conclusão: {current.completionSummary}</p>
        )}
        {current.completionResult && (
          <p className={styles.muted}>Resultado: {current.completionResult}</p>
        )}
      </Card>
      <Card>
        <h2>Demanda</h2>
        {current.task ? (
          <p>
            Tarefa vinculada:{" "}
            <Link to={`/tasks/${current.task.id}`}>{current.task.title}</Link>
          </p>
        ) : current.incident ? (
          <p>
            Incidente vinculado: {current.incident.code}
          </p>
        ) : (
          <p className={styles.muted}>
            Demanda operacional genérica, sem tarefa ou incidente vinculado.
          </p>
        )}
        <p className={styles.muted}>
          Especialidades da equipe:{" "}
          {current.specialties.length
            ? current.specialties.join(", ")
            : "nenhuma cadastrada"}
        </p>
      </Card>
      {!!allowed.length && (
        <Card>
          <h2>Ações</h2>
          <form className={styles.form} onSubmit={(event) => void submit(event)}>
            <Field label="Transição">
              <Select
                required
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
                <option value="">Selecione</option>
                {allowed.map((option) => (
                  <option key={option} value={option}>
                    {DISPATCH_STATUS_LABELS[option]}
                  </option>
                ))}
              </Select>
            </Field>
            {(status === "REJECTED" || status === "CANCELLED") && (
              <Field label="Motivo">
                <Input
                  required
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                />
              </Field>
            )}
            {status === "COMPLETED" && (
              <Field label="Resumo da conclusão">
                <Input
                  required
                  value={summary}
                  onChange={(event) => setSummary(event.target.value)}
                />
              </Field>
            )}
            {status === "DISPATCHED" && (
              <Field label="Responsável individual (opcional)">
                <Select
                  value={memberId}
                  onChange={(event) => setMemberId(event.target.value)}
                >
                  <option value="">Manter equipe inteira</option>
                  {members.data?.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            <Field label="Observação na timeline (opcional)">
              <Input
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </Field>
            <Button type="submit" disabled={!status}>
              Aplicar transição
            </Button>
          </form>
        </Card>
      )}
      <Card>
        <h2>Timeline</h2>
        <ol className={styles.timeline}>
          {current.events.map((entry) => (
            <li key={entry.id}>
              <strong>{entry.message}</strong>
              <small>
                {entry.actor?.name ?? "Sistema"}
                {entry.fromStatus && entry.toStatus
                  ? ` · ${DISPATCH_STATUS_LABELS[entry.fromStatus]} → ${DISPATCH_STATUS_LABELS[entry.toStatus]}`
                  : ""}
              </small>
              <time dateTime={entry.createdAt}>
                {new Date(entry.createdAt).toLocaleString("pt-BR")}
              </time>
            </li>
          ))}
        </ol>
      </Card>
    </section>
  );
}
