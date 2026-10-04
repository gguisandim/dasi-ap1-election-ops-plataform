import {
  Card,
  EmptyState,
  ErrorState,
  LinkButton,
  Loading,
  useAsync,
} from "@eops/ui";
import { fieldTeamsService } from "../services/fieldTeamsService";
import { FieldNav } from "../components/FieldNav";
import styles from "../styles/fieldTeams.module.css";

export function ShiftsPage() {
  const now = new Date();
  const end = new Date(now.getTime() + 7 * 86400000);
  const shifts = useAsync(
    () =>
      fieldTeamsService.upcomingShifts({
        startsFrom: now.toISOString(),
        startsTo: end.toISOString(),
      }),
    [],
  );
  return (
    <section className={styles.page}>
      <FieldNav />
      <header className={styles.header}>
        <div>
          <span>CONTRATO READ-ONLY</span>
          <h1>Próximos turnos</h1>
          <p>Shifts é o owner de criação, assignments e lifecycle.</p>
        </div>
        <LinkButton to="/shifts/calendar">
          Abrir calendário de Shifts
        </LinkButton>
      </header>
      {shifts.loading && <Loading label="Carregando turnos…" />}
      {shifts.error && (
        <ErrorState error={shifts.error} onRetry={shifts.reload} />
      )}
      {shifts.data?.length === 0 && (
        <EmptyState
          title="Nenhum turno nos próximos sete dias"
          description="Crie e administre turnos no módulo Escalas e Turnos."
        />
      )}
      {!!shifts.data?.length && (
        <Card>
          <div className={styles.schedule}>
            {shifts.data.map((shift) => (
              <article key={shift.id}>
                <time>{new Date(shift.startsAt).toLocaleString("pt-BR")}</time>
                <div>
                  <strong>{shift.name ?? "Turno operacional"}</strong>
                  <span>
                    {shift.coverage.availableOperators}/
                    {shift.requiredOperators} pessoas · {shift.coverage.state}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </Card>
      )}
    </section>
  );
}
