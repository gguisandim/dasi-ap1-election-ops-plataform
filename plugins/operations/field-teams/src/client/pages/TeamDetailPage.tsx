import { Badge, Card, ErrorState, LinkButton, Loading, useAsync } from "@eops/ui";
import { useParams } from "react-router-dom";
import { FieldNav } from "../components/FieldNav";
import { fieldTeamsService } from "../services/fieldTeamsService";
import { MEMBER_STATUS_LABELS } from "../../types";
import styles from "../styles/fieldTeams.module.css";

export function TeamDetailPage() {
  const { id = "" } = useParams(); const team = useAsync(() => fieldTeamsService.team(id), [id]);
  if (team.loading) return <Loading label="Carregando equipe…" />; if (team.error || !team.data) return <ErrorState error={team.error ?? new Error("Equipe não encontrada.")} />; const data = team.data;
  return <section className={styles.page}><FieldNav /><header className={styles.header}><div><span>{data.code}</span><h1>{data.name}</h1><p>{data.election.name} · Responsável: {data.responsibleName}</p></div><LinkButton to={`/field-teams/members?teamId=${data.id}`}>Adicionar membro</LinkButton></header><div className={styles.metrics}><Card><span>Status</span><strong>{data.status}</strong></Card><Card><span>Membros</span><strong>{data.members.length}</strong></Card><Card><span>Disponíveis</span><strong>{data.members.filter((item) => item.status === "AVAILABLE").length}</strong></Card><Card><span>Em serviço</span><strong>{data.members.filter((item) => item.status === "ON_DUTY").length}</strong></Card><Card><span>Alocações</span><strong>{data.allocations.length}</strong></Card></div><Card><h2>Contatos e especialidades</h2><div className={styles.tableWrap}><table><thead><tr><th>Membro</th><th>Função</th><th>Especialidades</th><th>Contato</th><th>Status</th></tr></thead><tbody>{data.members.map((member) => <tr key={member.id}><td>{member.name}</td><td>{member.role.name}</td><td>{member.specialties.map((item) => item.specialty.name).join(", ") || "—"}</td><td>{member.phone || "—"}<small>{member.email || ""}</small></td><td><Badge tone={member.status === "ON_DUTY" ? "success" : member.status === "UNAVAILABLE" ? "danger" : "neutral"}>{MEMBER_STATUS_LABELS[member.status]}</Badge></td></tr>)}</tbody></table></div></Card></section>;
}
