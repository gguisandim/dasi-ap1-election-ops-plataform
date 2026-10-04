import { Button, EmptyState, ErrorState, Loading, useAsync } from "@eops/ui";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ShiftsNav } from "../components/ShiftsNav";
import { shiftsService } from "../services/shiftsService";
import styles from "../styles/shifts.module.css";

function startOfWeek(value: Date) {
  const date = new Date(value);
  const day = date.getDay();
  date.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
  date.setHours(0, 0, 0, 0);
  return date;
}

export function ShiftsCalendarPage() {
  const [anchor, setAnchor] = useState(() => startOfWeek(new Date()));
  const end = useMemo(
    () => new Date(anchor.getTime() + 7 * 86400000),
    [anchor],
  );
  const calendar = useAsync(
    () =>
      shiftsService.calendar({
        startsFrom: anchor.toISOString(),
        startsTo: end.toISOString(),
      }),
    [anchor, end],
  );
  const days = Array.from(
    { length: 7 },
    (_, index) => new Date(anchor.getTime() + index * 86400000),
  );
  return (
    <section className={styles.page}>
      <ShiftsNav />
      <header className={styles.header}>
        <div>
          <span>PLANEJAMENTO SEMANAL</span>
          <h1>CalendÃ¡rio de turnos</h1>
          <p>Equipe, local, headcount e cobertura em uma visÃ£o operacional.</p>
        </div>
        <div className={styles.actions}>
          <Button
            onClick={() => setAnchor(new Date(anchor.getTime() - 7 * 86400000))}
          >
            Semana anterior
          </Button>
          <Button onClick={() => setAnchor(startOfWeek(new Date()))}>
            Hoje
          </Button>
          <Button
            onClick={() => setAnchor(new Date(anchor.getTime() + 7 * 86400000))}
          >
            PrÃ³xima semana
          </Button>
        </div>
      </header>
      {calendar.loading && <Loading label="Carregando calendÃ¡rioâ€¦" />}
      {calendar.error && (
        <ErrorState error={calendar.error} onRetry={calendar.reload} />
      )}
      {calendar.data?.items.length === 0 && (
        <EmptyState
          title="Semana sem turnos"
          description="Crie um turno ou use um template para preencher o calendÃ¡rio."
        />
      )}
      <div className={styles.calendarGrid}>
        {days.map((day) => {
          const items =
            calendar.data?.items.filter((shift) => {
              const value = new Date(shift.startsAt);
              return value.toDateString() === day.toDateString();
            }) ?? [];
          return (
            <section className={styles.calendarDay} key={day.toISOString()}>
              <h2>
                {day.toLocaleDateString("pt-BR", {
                  weekday: "short",
                  day: "2-digit",
                  month: "2-digit",
                })}
              </h2>
              {items.map((shift) => (
                <Link key={shift.id} to={"/shifts/" + shift.id}>
                  <strong>
                    {new Date(shift.startsAt).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    Â· {shift.name}
                  </strong>
                  <span>{shift.team.name}</span>
                  <small>
                    {shift.coverage.availableOperators}/
                    {shift.requiredOperators} Â· {shift.coverage.state}
                  </small>
                </Link>
              ))}
            </section>
          );
        })}
      </div>
    </section>
  );
}
