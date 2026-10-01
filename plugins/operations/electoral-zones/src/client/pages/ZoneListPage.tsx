import { useState } from "react";
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Input,
  LinkButton,
  Loading,
  useAsync,
} from "@eops/ui";
import { STATUS_LABELS } from "@eops/shared";
import { Link, useSearchParams } from "react-router-dom";
import { electoralZoneService } from "../services/electoralZoneService";
import styles from "../styles/zones.module.css";

export function ZoneListPage() {
  const [params] = useSearchParams();
  const electionId = params.get("electionId") ?? "";
  const [search, setSearch] = useState("");
  const { data, error, loading, reload } = useAsync(
    () => electoralZoneService.list(electionId, search),
    [electionId, search],
  );
  async function remove(id: string) {
    if (window.confirm("Excluir esta zona e todos os locais vinculados?")) {
      await electoralZoneService.remove(id);
      reload();
    }
  }
  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div>
          <span>OPERAÇÕES</span>
          <h1>Zonas Eleitorais</h1>
          <p>Organização territorial vinculada aos pleitos.</p>
        </div>
        <LinkButton
          to={`/electoral-zones/new${electionId ? `?electionId=${electionId}` : ""}`}
        >
          Nova zona
        </LinkButton>
      </header>
      <Input
        aria-label="Pesquisar zonas"
        placeholder="Pesquisar por nome ou município"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      {loading && <Loading />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {!loading && data?.length === 0 && (
        <EmptyState
          title="Nenhuma zona encontrada"
          description="Ajuste a pesquisa ou cadastre uma zona eleitoral."
        />
      )}
      {data && data.length > 0 && (
        <div className={styles.grid}>
          {data.map((zone) => (
            <article key={zone.id}>
              <div className={styles.cardHead}>
                <strong>Zona {zone.number}</strong>
                <Badge>{STATUS_LABELS[zone.status]}</Badge>
              </div>
              <h2>{zone.name}</h2>
              <p>
                {zone.municipality} · {zone.state}
              </p>
              <small>{zone.election.name}</small>
              <dl>
                <div>
                  <dt>Locais</dt>
                  <dd>{zone.pollingPlaceCount}</dd>
                </div>
                <div>
                  <dt>Seções</dt>
                  <dd>{zone.sectionCount}</dd>
                </div>
              </dl>
              <footer>
              <Link data-testid="zone-details-link" to={`/electoral-zones/${zone.id}`}>Detalhes</Link>
                <Link to={`/electoral-zones/${zone.id}/edit`}>Editar</Link>
                <Button onClick={() => void remove(zone.id)}>Excluir</Button>
              </footer>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
