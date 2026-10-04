import { Badge, Button, ErrorState, Loading, Select, useAsync } from "@eops/ui";
import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { ShiftsNav } from "../components/ShiftsNav";
import { shiftsService } from "../services/shiftsService";
import styles from "../styles/shifts.module.css";

export function ShiftDetailPage() {
  const { id } = useParams();
  const shiftQuery = useAsync(() => shiftsService.shift(id ?? ""), [id]);
  const references = useAsync(shiftsService.references, []);
  const [memberId, setMemberId] = useState("");
  const [reason, setReason] = useState("");
  const [substituteMemberId, setSubstituteMemberId] = useState("");

  const shift = shiftQuery.data;
  const assignableMembers = useMemo(
    () =>
      references.data?.members.filter(
        (member) => member.teamId === shift?.teamId,
      ) ?? [],
    [references.data, shift?.teamId],
  );

  async function refresh() {
    await shiftQuery.reload();
    await references.reload();
  }

  async function handleStatus(action: "start" | "complete" | "cancel") {
    if (!shift) return;
    if (action === "start") await shiftsService.start(shift.id);
    if (action === "complete") await shiftsService.complete(shift.id);
    if (action === "cancel") await shiftsService.cancel(shift.id);
    await refresh();
  }

  async function handleAssign() {
    if (!shift || !memberId) return;
    await shiftsService.assign(shift.id, { memberId, status: "SCHEDULED" });
    setMemberId("");
    await refresh();
  }

  async function handlePresence(assignmentId: string) {
    if (!shift) return;
    await shiftsService.presence(shift.id, assignmentId);
    await refresh();
  }

  async function handleAbsence(assignmentId: string) {
    if (!shift) return;
    await shiftsService.absence(shift.id, assignmentId, reason || undefined);
    setReason("");
    await refresh();
  }

  async function handleOnCall(assignmentId: string) {
    if (!shift) return;
    await shiftsService.activateOnCall(shift.id, assignmentId);
    await refresh();
  }

  async function handleReplace(assignmentId: string) {
    if (!shift || !substituteMemberId) return;
    await shiftsService.replace(shift.id, assignmentId, {
      substituteMemberId,
      reason: reason || undefined,
    });
    setSubstituteMemberId("");
    setReason("");
    await refresh();
  }

  if (!id) return <div>Turno inválido.</div>;
  if (shiftQuery.loading) return <Loading label="Carregando turno…" />;
  if (shiftQuery.error)
    return (
      <ErrorState error={shiftQuery.error} onRetry={() => void refresh()} />
    );
  if (!shift) return <div>Turno não encontrado.</div>;

  return (
    <section className={styles.page}>
      <ShiftsNav />
      <header className={styles.header}>
        <div>
          <span>DETALHE DO TURNO</span>
          <h1>{shift.name ?? "Turno"}</h1>
          <p>
            {shift.team.name} ·{" "}
            {new Date(shift.startsAt).toLocaleString("pt-BR", {
              dateStyle: "short",
              timeStyle: "short",
            })}
          </p>
        </div>
        <div className={styles.actions}>
          {shift.status === "SCHEDULED" && (
            <Button type="button" onClick={() => void handleStatus("start")}>
              Iniciar
            </Button>
          )}
          {shift.status === "IN_PROGRESS" && (
            <Button type="button" onClick={() => void handleStatus("complete")}>
              Concluir
            </Button>
          )}
          {(shift.status === "SCHEDULED" || shift.status === "IN_PROGRESS") && (
            <Button
              type="button"
              className={styles.danger}
              onClick={() => void handleStatus("cancel")}
            >
              Cancelar
            </Button>
          )}
        </div>
      </header>

      <div className={styles.detailGrid}>
        <div className={styles.detailMain}>
          <div className={styles.panel}>
            <div className={styles.meta}>
              <div className={styles.metaItem}>
                <span>Status</span>
                <strong>{shift.status}</strong>
              </div>
              <div className={styles.metaItem}>
                <span>Cobertura</span>
                <strong>{shift.coverage.percentage}%</strong>
              </div>
              <div className={styles.metaItem}>
                <span>Necessários</span>
                <strong>{shift.requiredOperators}</strong>
              </div>
              <div className={styles.metaItem}>
                <span>Alocados</span>
                <strong>{shift.assignments.length}</strong>
              </div>
            </div>
          </div>

          <div className={styles.panel}>
            <div className={styles.sectionHeading}>
              <h2>Alocações</h2>
              <Badge
                tone={
                  shift.coverage.state === "FULL"
                    ? "success"
                    : shift.coverage.state === "CRITICAL" ||
                        shift.coverage.state === "EMPTY"
                      ? "danger"
                      : "warning"
                }
              >
                {shift.coverage.state}
              </Badge>
            </div>
            <div className={styles.assignmentList}>
              {shift.assignments.map((assignment) => (
                <div className={styles.assignmentItem} key={assignment.id}>
                  <div>
                    <strong>{assignment.member.name}</strong>
                    <small>
                      {assignment.status} ·{" "}
                      {assignment.role?.name ?? "Função não definida"}
                    </small>
                  </div>
                  <div className={styles.actions}>
                    {(assignment.status === "SCHEDULED" ||
                      assignment.status === "ON_CALL") && (
                      <button
                        type="button"
                        className={styles.inlineButton}
                        onClick={() => void handlePresence(assignment.id)}
                      >
                        Presença
                      </button>
                    )}
                    {assignment.status === "ON_CALL" &&
                      !assignment.onCallActivatedAt && (
                        <button
                          type="button"
                          className={styles.inlineButton}
                          onClick={() => void handleOnCall(assignment.id)}
                        >
                          Sobreaviso
                        </button>
                      )}
                  </div>
                  <div className={styles.actions}>
                    {assignment.status !== "ABSENT" &&
                      assignment.status !== "REPLACED" && (
                        <button
                          type="button"
                          className={styles.inlineButton}
                          onClick={() => void handleAbsence(assignment.id)}
                        >
                          Falta
                        </button>
                      )}
                    {assignment.status !== "ABSENT" &&
                      assignment.status !== "REPLACED" && (
                        <button
                          type="button"
                          className={`${styles.inlineButton} ${styles.danger}`}
                          onClick={() => void handleReplace(assignment.id)}
                        >
                          Substituir
                        </button>
                      )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.panel}>
            <div className={styles.sectionHeading}><h2>Cobertura</h2><Badge tone={shift.coverage.state === "FULL" ? "success" : "warning"}>{shift.coverage.state}</Badge></div>
            <div className={styles.meta}>
              <div className={styles.metaItem}><span>Presentes</span><strong>{shift.coverage.present}</strong></div>
              <div className={styles.metaItem}><span>Ausentes</span><strong>{shift.coverage.absent}</strong></div>
              <div className={styles.metaItem}><span>Sobreaviso</span><strong>{shift.coverage.onCall}</strong></div>
              <div className={styles.metaItem}><span>Headcount</span><strong>{shift.coverage.availableOperators}/{shift.coverage.requiredOperators}</strong></div>
            </div>
            <ul className={styles.historyList}>{shift.coverage.specialties.map((item) => <li key={item.specialtyId}><strong>{item.specialtyName}</strong><small>{item.assignedCount}/{item.requiredCount} · {item.met ? "Atendida" : "Lacuna"}</small></li>)}</ul>
          </div>

          <div className={styles.panel}>
            <div className={styles.sectionHeading}><h2>Conflitos</h2><Badge tone={shift.conflicts.length ? "danger" : "success"}>{shift.conflicts.length}</Badge></div>
            {!shift.conflicts.length && <p>Nenhum conflito temporal ou indisponibilidade detectado.</p>}
            <ul className={styles.historyList}>{shift.conflicts.map((item) => <li key={item.id}><strong>{item.memberName} · {item.type}</strong><small>{item.message}</small></li>)}</ul>
          </div>

          <div className={styles.panel}>
            <div className={styles.sectionHeading}>
              <h2>Histórico</h2>
            </div>
            <ul className={styles.historyList}>
              {shift.history.map((event) => (
                <li key={event.id}>
                  <strong>{event.action}</strong>
                  <small>{event.description}</small>
                  <small>
                    {new Date(event.createdAt).toLocaleString("pt-BR", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </small>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <aside className={styles.detailSide}>
          <div className={styles.panel}>
            <h2>Nova alocação</h2>
            <div className={styles.filters}>
              <Select
                value={memberId}
                onChange={(event) => setMemberId(event.target.value)}
              >
                <option value="">Selecione um operador</option>
                {assignableMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </Select>
              <button
                type="button"
                className={styles.inlineButton}
                onClick={() => void handleAssign()}
              >
                Alocar
              </button>
            </div>
          </div>

          <div className={styles.panel}>
            <h2>Registrar ausência/substituição</h2>
            <label>
              Motivo
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </label>
            <div className={styles.filters}>
              <Select
                value={substituteMemberId}
                onChange={(event) => setSubstituteMemberId(event.target.value)}
              >
                <option value="">Substituto</option>
                {assignableMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className={styles.panel}>
            <h2>Resumo</h2>
            <p>
              Local:{" "}
              {shift.pollingPlace?.name ??
                shift.electoralZone?.name ??
                "Pleito geral"}
            </p>
            <p>Equipe: {shift.team.name}</p>
            <p>Início: {new Date(shift.startsAt).toLocaleString("pt-BR")}</p>
            <p>Fim: {new Date(shift.endsAt).toLocaleString("pt-BR")}</p>
          </div>
        </aside>
      </div>
    </section>
  );
}
