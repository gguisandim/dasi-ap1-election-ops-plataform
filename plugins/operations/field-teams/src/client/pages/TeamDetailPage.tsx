import {
  Badge,
  Card,
  ErrorState,
  LinkButton,
  Loading,
  useAsync,
} from "@eops/ui";
import { Link, useParams } from "react-router-dom";
import { FieldNav } from "../components/FieldNav";
import { fieldTeamsService } from "../services/fieldTeamsService";
import { MEMBER_STATUS_LABELS } from "../../types";
import {
  DISPATCH_PRIORITY_LABELS,
  DISPATCH_STATUS_LABELS,
  dispatchOperationalState,
  formatDuration,
  OPERATIONAL_STATE_LABELS,
} from "../status";
import styles from "../styles/fieldTeams.module.css";

export function TeamDetailPage() {
  const { id = "" } = useParams();
  const team = useAsync(() => fieldTeamsService.team(id), [id]);
  const capabilities = useAsync(() => fieldTeamsService.capabilities(id), [id]);
  const dispatches = useAsync(
    () => fieldTeamsService.dispatches({ teamId: id, active: true }),
    [id],
  );
  const upcoming = useAsync(
    () =>
      fieldTeamsService.upcomingShifts({
        teamId: id,
        startsFrom: new Date().toISOString(),
        startsTo: new Date(Date.now() + 30 * 86400000).toISOString(),
      }),
    [id],
  );
  if (team.loading) return <Loading label="Carregando equipe…" />;
  if (team.error || !team.data)
    return (
      <ErrorState error={team.error ?? new Error("Equipe não encontrada.")} />
    );
  const data = team.data;
  return (
    <section className={styles.page}>
      <FieldNav />
      <header className={styles.header}>
        <div>
          <span>{data.code}</span>
          <h1>{data.name}</h1>
          <p>
            {data.election.name} · Responsável: {data.responsibleName}
          </p>
        </div>
        <LinkButton to={`/field-teams/members?teamId=${data.id}`}>
          Adicionar membro
        </LinkButton>
      </header>
      <div className={styles.metrics}>
        <Card>
          <span>Status</span>
          <strong>{data.status}</strong>
        </Card>
        <Card>
          <span>Membros</span>
          <strong>{data.members.length}</strong>
        </Card>
        <Card>
          <span>Disponíveis</span>
          <strong>
            {data.members.filter((item) => item.status === "AVAILABLE").length}
          </strong>
        </Card>
        <Card>
          <span>Em serviço</span>
          <strong>
            {data.members.filter((item) => item.status === "ON_DUTY").length}
          </strong>
        </Card>
        <Card>
          <span>Alocações</span>
          <strong>{data.allocations.length}</strong>
        </Card>
        <Card>
          <span>Estado operacional</span>
          <strong>
            {dispatches.data?.length
              ? OPERATIONAL_STATE_LABELS[
                  dispatchOperationalState(dispatches.data[0].status)
                ]
              : OPERATIONAL_STATE_LABELS.AVAILABLE}
          </strong>
        </Card>
      </div>
      <Card>
        <h2>Despacho atual</h2>
        {dispatches.loading && <Loading />}
        {dispatches.error && (
          <ErrorState error={dispatches.error} onRetry={dispatches.reload} />
        )}
        {dispatches.data && !dispatches.data.length && (
          <p className={styles.muted}>A equipe não possui dispatch ativo.</p>
        )}
        <div className={styles.list}>
          {dispatches.data?.map((item) => (
            <Link key={item.id} to={`/field-teams/dispatch/${item.id}`}>
              <div>
                <strong>{item.title}</strong>
                <span>
                  {DISPATCH_STATUS_LABELS[item.status]} ·{" "}
                  {item.memberName ?? "Equipe inteira"} · há{" "}
                  {formatDuration(item.elapsedMinutes)}
                </span>
              </div>
              <Badge
                tone={item.priority === "CRITICAL" ? "danger" : "warning"}
              >
                {DISPATCH_PRIORITY_LABELS[item.priority]}
              </Badge>
            </Link>
          ))}
        </div>
      </Card>
      <Card>
        <h2>Capabilities</h2>
        {capabilities.loading && <Loading />}
        {capabilities.error && (
          <ErrorState
            error={capabilities.error}
            onRetry={capabilities.reload}
          />
        )}
        <div className={styles.list}>
          {capabilities.data?.map((item) => (
            <article key={item.id}>
              <div>
                <strong>{item.name}</strong>
                <span>{item.memberCount} membro(s)</span>
              </div>
              <Badge tone={item.memberCount ? "success" : "danger"}>
                {item.memberCount ? "Coberta" : "Lacuna"}
              </Badge>
            </article>
          ))}
        </div>
      </Card>
      <Card>
        <h2>Próximos turnos</h2>
        {upcoming.loading && <Loading />}
        {upcoming.error && (
          <ErrorState error={upcoming.error} onRetry={upcoming.reload} />
        )}
        <div className={styles.list}>
          {upcoming.data?.map((shift) => (
            <Link key={shift.id} to={`/shifts/${shift.id}`}>
              <div>
                <strong>{shift.name ?? "Turno"}</strong>
                <span>{new Date(shift.startsAt).toLocaleString("pt-BR")}</span>
              </div>
              <Badge
                tone={shift.coverage.state === "FULL" ? "success" : "warning"}
              >
                {shift.coverage.state}
              </Badge>
            </Link>
          ))}
        </div>
      </Card>
      <Card>
        <h2>Contatos e especialidades</h2>
        <div className={styles.tableWrap}>
          <table>
            <thead>
              <tr>
                <th>Membro</th>
                <th>Função</th>
                <th>Especialidades</th>
                <th>Contato</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.members.map((member) => (
                <tr key={member.id}>
                  <td>
                    <Link to={`/field-teams/members/${member.id}`}>
                      {member.name}
                    </Link>
                  </td>
                  <td>{member.role.name}</td>
                  <td>
                    {member.specialties
                      .map((item) => item.specialty.name)
                      .join(", ") || "—"}
                  </td>
                  <td>
                    {member.phone || "—"}
                    <small>{member.email || ""}</small>
                  </td>
                  <td>
                    <Badge
                      tone={
                        member.status === "ON_DUTY"
                          ? "success"
                          : member.status === "UNAVAILABLE"
                            ? "danger"
                            : "neutral"
                      }
                    >
                      {MEMBER_STATUS_LABELS[member.status]}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  );
}
