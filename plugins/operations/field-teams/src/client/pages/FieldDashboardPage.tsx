import { Card, ErrorState, LinkButton, Loading, Select, useAsync } from "@eops/ui";
import { useState } from "react";
import { FieldNav } from "../components/FieldNav";
import { fieldTeamsService } from "../services/fieldTeamsService";
import { formatDuration } from "../status";
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
        <div className={styles.actions}>
          <LinkButton to="/field-teams/dispatch">Abrir despachos</LinkButton>
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
        </div>
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
      {dashboard.data && (
        <Card>
          <h2>Operação de campo</h2>
          <div className={styles.metrics}>
            <Card>
              <span>Aguardando envio</span>
              <strong>{dashboard.data.operations.awaiting}</strong>
            </Card>
            <Card>
              <span>Dispatches ativos</span>
              <strong>{dashboard.data.operations.active}</strong>
            </Card>
            <Card>
              <span>Em deslocamento</span>
              <strong>{dashboard.data.operations.enRoute}</strong>
            </Card>
            <Card>
              <span>No local ou em atendimento</span>
              <strong>{dashboard.data.operations.onSite}</strong>
            </Card>
            <Card>
              <span>Concluídos hoje</span>
              <strong>{dashboard.data.operations.completedToday}</strong>
            </Card>
            <Card>
              <span>Tempo médio até aceite</span>
              <strong>
                {formatDuration(
                  dashboard.data.operations.averageTimeToAcceptMinutes,
                )}
              </strong>
            </Card>
            <Card>
              <span>Tempo médio até chegada</span>
              <strong>
                {formatDuration(
                  dashboard.data.operations.averageTimeToArrivalMinutes,
                )}
              </strong>
            </Card>
          </div>
        </Card>
      )}
    </section>
  );
}
