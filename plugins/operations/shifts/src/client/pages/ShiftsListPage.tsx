import { ErrorState, Loading, Select, useAsync } from "@eops/ui";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ShiftsNav } from "../components/ShiftsNav";
import { shiftsService } from "../services/shiftsService";
import styles from "../styles/shifts.module.css";

export function ShiftsListPage() {
  const [filters, setFilters] = useState({ electionId: "", teamId: "", status: "" });
  const references = useAsync(shiftsService.references, []);
  const query = useMemo(() => ({
    electionId: filters.electionId || undefined,
    teamId: filters.teamId || undefined,
    status: filters.status ? (filters.status as never) : undefined,
  }), [filters]);
  const shifts = useAsync(() => shiftsService.shifts(query), [query]);
  const teamOptions = references.data?.teams.filter((item) => !filters.electionId || item.electionId === filters.electionId) ?? [];

  return (
    <section className={styles.page}>
      <ShiftsNav />
      <header className={styles.header}>
        <div>
          <span>LISTA</span>
          <h1>Escalas por turno</h1>
          <p>Consulta e acompanhamento de turnos e cobertura.</p>
        </div>
      </header>

      <div className={styles.panel}>
        <div className={styles.filters}>
          <label>
            Pleito
            <Select value={filters.electionId} onChange={(event) => setFilters((old) => ({ ...old, electionId: event.target.value, teamId: "" }))}>
              <option value="">Todos</option>
              {references.data?.elections.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </Select>
          </label>
          <label>
            Equipe
            <Select value={filters.teamId} onChange={(event) => setFilters((old) => ({ ...old, teamId: event.target.value }))}>
              <option value="">Todas</option>
              {teamOptions.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
            </Select>
          </label>
          <label>
            Status
            <Select value={filters.status} onChange={(event) => setFilters((old) => ({ ...old, status: event.target.value }))}>
              <option value="">Todos</option>
              <option value="SCHEDULED">Agendado</option>
              <option value="IN_PROGRESS">Em andamento</option>
              <option value="COMPLETED">Concluído</option>
              <option value="CANCELLED">Cancelado</option>
            </Select>
          </label>
        </div>
      </div>

      {shifts.loading && <Loading label="Carregando turnos…" />}
      {(shifts.error || references.error) && <ErrorState error={shifts.error ?? references.error} onRetry={() => { shifts.reload(); references.reload(); }} />}

      {shifts.data && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Turno</th>
                <th>Equipe</th>
                <th>Período</th>
                <th>Status</th>
                <th>Cobertura</th>
                <th>Alocados</th>
              </tr>
            </thead>
            <tbody>
              {shifts.data.map((shift) => (
                <tr key={shift.id}>
                  <td><Link to={`/shifts/${shift.id}`}>{shift.name ?? "Turno"}</Link></td>
                  <td>{shift.team.name}</td>
                  <td>
                    {new Date(shift.startsAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                    <small>→ {new Date(shift.endsAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</small>
                  </td>
                  <td>{shift.status}</td>
                  <td>{shift.coverage.percentage}%</td>
                  <td>{shift.assignments.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
