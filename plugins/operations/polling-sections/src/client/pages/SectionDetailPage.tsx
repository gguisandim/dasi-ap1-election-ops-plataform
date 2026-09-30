import {
  Badge,
  Breadcrumb,
  Card,
  ErrorState,
  LinkButton,
  Loading,
  useAsync,
} from "@eops/ui";
import { STATUS_LABELS } from "@eops/shared";
import { useParams } from "react-router-dom";
import { pollingSectionService } from "../services/pollingSectionService";
import styles from "../styles/sections.module.css";
export function SectionDetailPage() {
  const { id = "" } = useParams();
  const { data, error, loading, reload } = useAsync(
    () => pollingSectionService.get(id),
    [id],
  );
  if (loading) return <Loading />;
  if (error || !data)
    return (
      <ErrorState
        error={error ?? new Error("Seção não encontrada.")}
        onRetry={reload}
      />
    );
  const place = data.pollingPlace;
  const zone = place.electoralZone;
  return (
    <section className={styles.page}>
      <Breadcrumb
        items={[
          { label: zone.election.name, to: `/elections/${zone.election.id}` },
          { label: `Zona ${zone.number}`, to: `/electoral-zones/${zone.id}` },
          { label: place.name, to: `/polling-places/${place.id}` },
          { label: `Seção ${data.number}` },
        ]}
      />
      <header className={styles.header}>
        <div>
          <Badge>{STATUS_LABELS[data.status]}</Badge>
          <h1>Seção {data.number}</h1>
          <p>{place.name}</p>
        </div>
        <LinkButton secondary to={`/polling-sections/${id}/edit`}>
          Editar
        </LinkButton>
      </header>
      <Card>
        <dl className={styles.details}>
          <div>
            <dt>Eleitores registrados</dt>
            <dd>{data.registeredVoters.toLocaleString("pt-BR")}</dd>
          </div>
          <div>
            <dt>Zona eleitoral</dt>
            <dd>{zone.number}</dd>
          </div>
          <div>
            <dt>Município</dt>
            <dd>{zone.municipality}</dd>
          </div>
          <div>
            <dt>Pleito</dt>
            <dd>{zone.election.name}</dd>
          </div>
        </dl>
      </Card>
    </section>
  );
}
