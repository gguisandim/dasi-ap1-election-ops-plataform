import { EmptyState, ErrorState, Loading, useAsync } from "@eops/ui";
import { useState } from "react";
import { Link } from "react-router-dom";
import { ShiftsNav } from "../components/ShiftsNav";
import { shiftsService } from "../services/shiftsService";
import styles from "../styles/shifts.module.css";

export function ShiftCoveragePage() {
  const [start] = useState(() => new Date());
  const end = new Date(start.getTime() + 7 * 86400000);
  const result = useAsync(
    () =>
      shiftsService.coverage({
        startsFrom: start.toISOString(),
        startsTo: end.toISOString(),
      }),
    [start],
  );
  return (
    <section className={styles.page}>
      <ShiftsNav />
      <header className={styles.header}>
        <div>
          <span>COBERTURA REAL</span>
          <h1>Matriz de cobertura</h1>
          <p>Headcount e requirements por zona, local e horário.</p>
        </div>
      </header>
      {result.loading && <Loading label="Calculando cobertura…" />}
      {result.error && (
        <ErrorState error={result.error} onRetry={result.reload} />
      )}
      {result.data?.items.length === 0 && (
        <EmptyState
          title="Sem dados de cobertura"
          description="Não existem turnos no período selecionado."
        />
      )}
      {!!result.data?.items.length && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Zona / local</th>
                <th>Turno</th>
                <th>Horário</th>
                <th>Headcount</th>
                <th>Skills</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {result.data.items.map((item) => (
                <tr key={item.shiftId}>
                  <td>
                    {item.pollingPlace?.name ??
                      (item.electoralZone
                        ? "Zona " + item.electoralZone.number
                        : "Geral")}
                  </td>
                  <td>
                    <Link to={"/shifts/" + item.shiftId}>{item.name}</Link>
                    <small>{item.team.name}</small>
                  </td>
                  <td>
                    {new Date(item.startsAt).toLocaleString("pt-BR")}
                    <small>
                      até {new Date(item.endsAt).toLocaleString("pt-BR")}
                    </small>
                  </td>
                  <td>
                    {item.coverage.availableOperators}/
                    {item.coverage.requiredOperators}
                  </td>
                  <td>
                    {item.coverage.specialties.length
                      ? item.coverage.specialties
                          .map(
                            (skill) =>
                              skill.specialtyName +
                              " " +
                              skill.assignedCount +
                              "/" +
                              skill.requiredCount,
                          )
                          .join(", ")
                      : "Sem requirements"}
                  </td>
                  <td>
                    <span className={styles.statusBadge}>
                      {item.coverage.state}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
