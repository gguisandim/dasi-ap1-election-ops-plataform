import { Card, ErrorState, LinkButton, Loading, useAsync } from "@eops/ui";
import { useParams } from "react-router-dom";
import { routesService } from "../../services/routesService";
import styles from "../../styles/overview.module.css";

export function RouteHistoryPage() {
  const { id = "" } = useParams();
  const route = useAsync(() => routesService.get(id), [id]);
  if (route.loading) return <Loading label="Carregando histórico…" />;
  if (route.error || !route.data) return <ErrorState error={route.error ?? new Error("Rota não encontrada.")} />;
  return <section className={styles.page}><header className={styles.header}><div><span className={styles.tag}>{route.data.code}</span><h1>Histórico da rota</h1><p>Eventos persistidos de execução, entregas, atrasos e recolhimentos.</p></div><LinkButton to={`/routes/${id}`}>Voltar à rota</LinkButton></header><Card><ol className={styles.history}>{route.data.history.map((event) => <li key={event.id}><time>{new Date(event.createdAt).toLocaleString("pt-BR")}</time><div><strong>{event.type.replaceAll("_", " ")}</strong><p>{event.message}</p></div></li>)}</ol>{route.data.history.length === 0 && <p>Nenhum evento registrado.</p>}</Card></section>;
}
