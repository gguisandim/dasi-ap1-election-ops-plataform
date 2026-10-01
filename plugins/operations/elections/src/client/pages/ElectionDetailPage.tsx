import {
  Badge,
  Breadcrumb,
  Card,
  ErrorState,
  LinkButton,
  Loading,
  useAsync,
} from "@eops/ui";
import { STATUS_LABELS, TYPE_LABELS } from "@eops/shared/elections";
import { useParams } from "react-router-dom";
import { electionService } from "../services/electionService";
import styles from "../styles/elections.module.css";

export function ElectionDetailPage() {
  const { id = "" } = useParams();
  const { data, error, loading, reload } = useAsync(
    () => electionService.get(id),
    [id],
  );
  if (loading) return <Loading label="Carregando pleito…" />;
  if (error || !data)
    return (
      <ErrorState
        error={error ?? new Error("Pleito não encontrado.")}
        onRetry={reload}
      />
    );
  return (
    <section className={styles.page}>
      <Breadcrumb
        items={[{ label: "Pleitos", to: "/elections" }, { label: data.name }]}
      />
      <header className={styles.pageHeader}>
        <div>
          <span className={styles.eyebrow}>
            {TYPE_LABELS[data.type]} · {data.year}
          </span>
          <h1>{data.name}</h1>
          <p>{data.description}</p>
        </div>
        <LinkButton to={`/elections/${id}/edit`} secondary>
          Editar
        </LinkButton>
      </header>
      <div className={styles.metrics}>
        <Card>
          <span>Status</span>
          <strong>
            <Badge>{STATUS_LABELS[data.status]}</Badge>
          </strong>
        </Card>
        <Card>
          <span>Zonas</span>
          <strong>{data.zoneCount}</strong>
        </Card>
        <Card>
          <span>Locais</span>
          <strong>{data.pollingPlaceCount}</strong>
        </Card>
        <Card>
          <span>Seções</span>
          <strong>{data.sectionCount}</strong>
        </Card>
      </div>
      <Card>
        <div className={styles.sectionHead}>
          <h2>Turnos eleitorais</h2>
          <LinkButton to={`/electoral-zones?electionId=${id}`}>
            Ver zonas
          </LinkButton>
        </div>
        <div className={styles.rounds}>
          {data.rounds.map((round) => (
            <article key={round.id}>
              <strong>{round.roundNumber}º turno</strong>
              <span>
                {new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(
                  new Date(round.date),
                )}
              </span>
              <Badge>{STATUS_LABELS[round.status]}</Badge>
            </article>
          ))}
        </div>
      </Card>
    </section>
  );
}
