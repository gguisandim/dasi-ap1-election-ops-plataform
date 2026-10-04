import { Badge, ErrorState, Loading, Select, useAsync } from "@eops/ui";
import { useState } from "react";
import { Link } from "react-router-dom";
import { ShiftsNav } from "../components/ShiftsNav";
import { shiftsService } from "../services/shiftsService";
import styles from "../styles/shifts.module.css";

const coverageTone = (status: string) => {
  if (status === "FULL") return styles.success;
  if (status === "PARTIAL") return styles.warn;
  return styles.alert;
};

export function ShiftsDashboardPage() {
  const [electionId, setElectionId] = useState("");
  const references = useAsync(shiftsService.references, []);
  const dashboard = useAsync(
    () => shiftsService.dashboard({ electionId: electionId || undefined }),
    [electionId],
  );
  const data = dashboard.data;
  const metrics = data
    ? ([
        ["Turnos do dia", data.today, ""],
        ["Em andamento", data.inProgress, "warn"],
        ["Cobertura completa", data.fullCoverage, "success"],
        ["Cobertura parcial", data.partialCoverage, "warn"],
        ["Cobertura crítica", data.criticalCoverage, "alert"],
        ["Presentes", data.presentOperators, "success"],
        ["Faltas", data.absences, "alert"],
        ["Sobreaviso", data.onCall, "warn"],
        ["Cobertura insuficiente", data.insufficientCoverage, "alert"],
      ] as const)
    : [];

  return (
    <section className={styles.page}>
      <ShiftsNav />
      <header className={styles.header}>
        <div>
          <span>OPERAÇÕES · COBERTURA</span>
          <h1>Escalas e Turnos</h1>
          <p>Planejamento, presença e cobertura operacional por pleito.</p>
        </div>
        <div className={styles.headerActions}>
          <Select
            aria-label="Filtrar pleito"
            value={electionId}
            onChange={(event) => setElectionId(event.target.value)}
          >
            <option value="">Todos os pleitos</option>
            {references.data?.elections.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Select>
          <Link className={styles.primaryLink} to="/shifts/new">
            Novo turno
          </Link>
        </div>
      </header>

      {dashboard.loading && <Loading label="Carregando cobertura…" />}
      {(dashboard.error || references.error) && (
        <ErrorState
          error={dashboard.error ?? references.error}
          onRetry={() => {
            dashboard.reload();
            references.reload();
          }}
        />
      )}

      {data && (
        <>
          <div className={styles.metrics}>
            {metrics.map(([label, value, tone]) => (
              <div
                className={`${styles.metric} ${tone ? (tone === "alert" ? styles.alert : tone === "warn" ? styles.warning : styles.success) : ""}`}
                key={label}
              >
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>

          <section className={styles.panel}>
            <div className={styles.sectionHeading}>
              <h2>Escalas em atenção</h2>
              <Badge tone={data.attentionShifts.length ? "danger" : "success"}>
                {data.attentionShifts.length}
              </Badge>
            </div>
            {data.attentionShifts.length ? (
              <div className={styles.attentionList}>
                {data.attentionShifts.map((shift) => (
                  <div className={styles.attentionRow} key={shift.id}>
                    <div>
                      <Link to={`/shifts/${shift.id}`}>
                        {shift.name ?? "Turno"}
                      </Link>
                      <small>
                        {shift.team.name} ·{" "}
                        {new Date(shift.startsAt).toLocaleString("pt-BR", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </small>
                    </div>
                    <span
                      className={`${styles.statusBadge} ${coverageTone(shift.coverage.state)}`}
                    >
                      {shift.coverage.percentage}%
                    </span>
                    <span>{shift.status}</span>
                    <span>{shift.assignments.length} alocações</span>
                    <span>
                      {shift.coverage.state === "FULL"
                        ? "OK"
                        : "Cobertura pendente"}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p>Não há turnos com atenção pendente no momento.</p>
            )}
          </section>
        </>
      )}
    </section>
  );
}
