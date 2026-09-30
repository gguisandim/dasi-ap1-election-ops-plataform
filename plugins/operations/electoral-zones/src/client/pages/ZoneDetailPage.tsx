import {
  Badge,
  Breadcrumb,
  Card,
  EmptyState,
  ErrorState,
  LinkButton,
  Loading,
  useAsync,
} from "@eops/ui";
import { STATUS_LABELS } from "@eops/shared";
import { Link, useParams } from "react-router-dom";
import { electoralZoneService } from "../services/electoralZoneService";
import styles from "../styles/zones.module.css";
export function ZoneDetailPage() {
  const { id = "" } = useParams();
  const { data, error, loading, reload } = useAsync(
    () => electoralZoneService.get(id),
    [id],
  );
  if (loading) return <Loading />;
  if (error || !data)
    return (
      <ErrorState
        error={error ?? new Error("Zona não encontrada.")}
        onRetry={reload}
      />
    );
  return (
    <section className={styles.page}>
      <Breadcrumb
        items={[
          { label: data.election.name, to: `/elections/${data.election.id}` },
          { label: `Zona ${data.number}` },
        ]}
      />
      <header className={styles.header}>
        <div>
          <Badge>{STATUS_LABELS[data.status]}</Badge>
          <h1>
            Zona {data.number} — {data.name}
          </h1>
          <p>
            {data.municipality} · {data.state}
          </p>
        </div>
        <LinkButton secondary to={`/electoral-zones/${id}/edit`}>
          Editar
        </LinkButton>
      </header>
      <Card>
        <div className={styles.sectionHead}>
          <h2>Locais vinculados ({data.pollingPlaceCount})</h2>
          <LinkButton to={`/polling-places/new?zoneId=${id}`}>
            Novo local
          </LinkButton>
        </div>
        {data.pollingPlaces.length === 0 ? (
          <EmptyState
            title="Sem locais"
            description="Cadastre o primeiro local desta zona."
          />
        ) : (
          <ul className={styles.list}>
            {data.pollingPlaces.map((place) => (
              <li key={place.id}>
                <Link to={`/polling-places/${place.id}`}>{place.name}</Link>
                <span>
                  {place.address} · {place.sectionCount} seções
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </section>
  );
}
