import { Card, ErrorState, Loading, Select, useAsync } from "@eops/ui";
import { useState } from "react";
import { FieldNav } from "../components/FieldNav";
import { fieldTeamsService } from "../services/fieldTeamsService";
import styles from "../styles/fieldTeams.module.css";

export function FieldDashboardPage() {
  const [electionId, setElectionId] = useState("");
  const references = useAsync(fieldTeamsService.references, []);
  const dashboard = useAsync(
    () =>
      fieldTeamsService.dashboard({
        electionId: electionId || undefined,
      }),
    [electionId],
  );

  return (
    <section className={styles.page}>
      <FieldNav />
      <header className={styles.header}>
        <div>
          <span>WORKFORCE</span>
          <h1>Equipes de Campo</h1>
          <p>Estrutura, disponibilidade e capacidades operacionais.</p>
        </div>
        <Select
          aria-label="Pleito"
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
      </header>
      {dashboard.loading && <Loading label="Carregando workforce…" />}
      {dashboard.error && (
        <ErrorState error={dashboard.error} onRetry={dashboard.reload} />
      )}
      {dashboard.data && (
        <div className={styles.metrics}>
          <Card>
            <span>Equipes ativas</span>
            <strong>{dashboard.data.activeTeams}</strong>
          </Card>
          <Card>
            <span>Disponíveis</span>
            <strong>{dashboard.data.availablePeople}</strong>
          </Card>
          <Card>
            <span>Indisponíveis</span>
            <strong>{dashboard.data.unavailablePeople}</strong>
          </Card>
          <Card>
            <span>Em serviço</span>
            <strong>{dashboard.data.onDutyPeople}</strong>
          </Card>
          <Card>
            <span>Sem alocação</span>
            <strong>{dashboard.data.unallocatedPeople}</strong>
          </Card>
          <Card>
            <span>Sem especialidade</span>
            <strong>{dashboard.data.peopleWithoutSpecialties}</strong>
          </Card>
          <Card>
            <span>Zonas sem equipe</span>
            <strong>{dashboard.data.uncoveredZones}</strong>
          </Card>
          <Card>
            <span>Locais sem cobertura</span>
            <strong>{dashboard.data.uncoveredPlaces}</strong>
          </Card>
        </div>
      )}
    </section>
  );
}
