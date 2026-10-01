import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  LinkButton,
  Loading,
  useAsync,
} from "@eops/ui";
import { STATUS_LABELS } from "@eops/shared/elections";
import { Link, useSearchParams } from "react-router-dom";
import { pollingSectionService } from "../services/pollingSectionService";
import styles from "../styles/sections.module.css";
export function SectionListPage() {
  const [params] = useSearchParams();
  const placeId = params.get("pollingPlaceId") ?? "";
  const { data, error, loading, reload } = useAsync(
    () => pollingSectionService.list(placeId),
    [placeId],
  );
  async function remove(id: string) {
    if (window.confirm("Excluir esta seção?")) {
      await pollingSectionService.remove(id);
      reload();
    }
  }
  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div>
          <span>OPERAÇÕES</span>
          <h1>Seções Eleitorais</h1>
          <p>Seções vinculadas aos locais de votação.</p>
        </div>
        <LinkButton
          to={`/polling-sections/new${placeId ? `?pollingPlaceId=${placeId}` : ""}`}
        >
          Nova seção
        </LinkButton>
      </header>
      {loading && <Loading />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {!loading && data?.length === 0 && (
        <EmptyState
          title="Nenhuma seção encontrada"
          description="Cadastre a primeira seção eleitoral."
        />
      )}
      {data && data.length > 0 && (
        <div className={styles.grid}>
          {data.map((section) => (
            <article key={section.id}>
              <Badge>{STATUS_LABELS[section.status]}</Badge>
              <h2>Seção {section.number}</h2>
              <p>{section.pollingPlace.name}</p>
              <small>
                Zona {section.pollingPlace.electoralZone.number} ·{" "}
                {section.registeredVoters} eleitores
              </small>
              <footer>
                <Link to={`/polling-sections/${section.id}`}>Detalhes</Link>
                <Link to={`/polling-sections/${section.id}/edit`}>Editar</Link>
                <Button onClick={() => void remove(section.id)}>Excluir</Button>
              </footer>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
