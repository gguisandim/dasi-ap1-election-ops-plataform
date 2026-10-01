import { Card, ErrorState, Loading, Select, useAsync } from "@eops/ui";
import { useState } from "react";
import { FieldNav } from "../components/FieldNav";
import { fieldTeamsService } from "../services/fieldTeamsService";
import styles from "../styles/fieldTeams.module.css";

export function FieldDashboardPage() {
  const [electionId, setElectionId] = useState("");
  const references = useAsync(fieldTeamsService.references, []);
  const dashboard = useAsync(() => fieldTeamsService.dashboard({ electionId: electionId || undefined }), [electionId]);
  return <section className={styles.page}><FieldNav /><header className={styles.header}><div><span>OPERAÇÕES</span><h1>Equipes de Campo</h1><p>Cobertura, disponibilidade e próximos turnos da operação distribuída.</p></div><Select aria-label="Pleito" value={electionId} onChange={(event) => setElectionId(event.target.value)}><option value="">Todos os pleitos</option>{references.data?.elections.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></header>{dashboard.loading && <Loading label="Carregando cobertura…" />}{dashboard.error && <ErrorState error={dashboard.error} onRetry={dashboard.reload} />}{dashboard.data && <><div className={styles.metrics}><Card><span>Equipes ativas</span><strong>{dashboard.data.activeTeams}</strong></Card><Card><span>Pessoas disponíveis</span><strong>{dashboard.data.availablePeople}</strong></Card><Card><span>Em serviço</span><strong>{dashboard.data.onDutyPeople}</strong></Card><Card><span>Zonas sem equipe</span><strong>{dashboard.data.uncoveredZones}</strong></Card><Card><span>Locais sem cobertura</span><strong>{dashboard.data.uncoveredPlaces}</strong></Card></div><Card><h2>Próximos turnos</h2><div className={styles.tableWrap}><table><thead><tr><th>Início</th><th>Equipe</th><th>Membro</th><th>Local</th><th>Fim</th></tr></thead><tbody>{dashboard.data.upcomingShifts.map((shift) => <tr key={shift.id}><td>{new Date(shift.startsAt).toLocaleString("pt-BR")}</td><td>{shift.team.name}</td><td>{shift.member?.name ?? "Equipe completa"}</td><td>{shift.pollingPlace?.name ?? (shift.electoralZone ? `Zona ${shift.electoralZone.number}` : "—")}</td><td>{new Date(shift.endsAt).toLocaleString("pt-BR")}</td></tr>)}</tbody></table></div>{dashboard.data.upcomingShifts.length === 0 && <p>Nenhum turno nos próximos sete dias.</p>}</Card></>}</section>;
}
