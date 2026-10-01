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
import { pollingPlaceService } from "../services/pollingPlaceService";
import styles from "../styles/places.module.css";
export function PollingPlaceDetailPage() {
  const { id = "" } = useParams();
  const { data, error, loading, reload } = useAsync(
    () => pollingPlaceService.get(id),
    [id],
  );
  if (loading) return <Loading />;
  if (error || !data)
    return (
      <ErrorState
        error={error ?? new Error("Local não encontrado.")}
        onRetry={reload}
      />
    );
  const zone = data.electoralZone;
  return (
    <section className={styles.page}>
      <Breadcrumb
        items={[
          { label: zone.election.name, to: `/elections/${zone.election.id}` },
          { label: `Zona ${zone.number}`, to: `/electoral-zones/${zone.id}` },
          { label: data.name },
        ]}
      />
      <header className={styles.header}>
        <div>
          <Badge
            tone={
              data.monitoringStatus === "NORMAL"
                ? "success"
                : data.monitoringStatus === "ATTENTION"
                  ? "warning"
                  : "danger"
            }
          >
            {STATUS_LABELS[data.monitoringStatus]}
          </Badge>
          <h1>{data.name}</h1>
          <p>
            {data.address}, {data.district} · {data.city}/{data.state}
          </p>
        </div>
        <LinkButton secondary to={`/polling-places/${id}/edit`}>
          Editar
        </LinkButton>
      </header>
      <div className={styles.metrics}>
        <Card>
          <span>Zona</span>
          <strong>{zone.number}</strong>
        </Card>
        <Card>
          <span>Seções</span>
          <strong>{data.sectionCount}</strong>
        </Card>
        <Card>
          <span>Eleitores estimados</span>
          <strong>{data.registeredVoters.toLocaleString("pt-BR")}</strong>
        </Card>
        <Card>
          <span>Coordenadas</span>
          <strong className={styles.coordinates}>
            {data.latitude ?? "—"}, {data.longitude ?? "—"}
          </strong>
        </Card>
        <Card>
          <span>Incidentes ativos</span>
          <strong>{data.activeIncidentCount ?? 0}</strong>
          <div className={styles.metricActions}>
            <Link to={`/incidents?pollingPlaceId=${id}`}>Ver incidentes</Link>
            <Link to={`/incidents/new?pollingPlaceId=${id}`}>Novo incidente</Link>
          </div>
        </Card>
        <Card>
          <span>Equipamentos</span>
          <strong>{data.assetCount ?? 0}</strong>
          <div className={styles.metricActions}>
            <Link to={`/inventory?pollingPlaceId=${id}`}>Ver equipamentos</Link>
            <Link to={`/inventory/new?pollingPlaceId=${id}`}>Novo ativo</Link>
          </div>
        </Card>
      </div>
      <Card>
        <div className={styles.sectionHead}>
          <h2>Seções eleitorais</h2>
          <LinkButton to={`/polling-sections/new?pollingPlaceId=${id}`}>
            Nova seção
          </LinkButton>
        </div>
        {data.sections.length === 0 ? (
          <EmptyState
            title="Sem seções"
            description="Cadastre a primeira seção deste local."
          />
        ) : (
          <ul className={styles.sections}>
            {data.sections.map((section) => (
              <li key={section.id}>
                <Link to={`/polling-sections/${section.id}`}>
                  Seção {section.number}
                </Link>
                <span>{section.registeredVoters} eleitores</span>
                <Badge>{STATUS_LABELS[section.status]}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </section>
  );
}
