import { useState } from "react";
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Input,
  LinkButton,
  Loading,
  Pagination,
  useAsync,
} from "@eops/ui";
import { STATUS_LABELS } from "@eops/shared/elections";
import { Link, useSearchParams } from "react-router-dom";
import { pollingPlaceService } from "../services/pollingPlaceService";
import styles from "../styles/places.module.css";
export function PollingPlaceListPage() {
  const [params] = useSearchParams();
  const zoneId = params.get("zoneId") ?? "";
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useAsync(
    () => pollingPlaceService.list({ zoneId, search, page }),
    [zoneId, search, page],
  );
  async function remove(id: string) {
    if (window.confirm("Excluir este local e suas seções?")) {
      await pollingPlaceService.remove(id);
      reload();
    }
  }
  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div>
          <span>OPERAÇÕES</span>
          <h1>Locais de Votação</h1>
          <p>Pesquisa, filtros e acompanhamento da rede de locais.</p>
        </div>
        <LinkButton
          to={`/polling-places/new${zoneId ? `?zoneId=${zoneId}` : ""}`}
        >
          Novo local
        </LinkButton>
      </header>
      <Input
        aria-label="Pesquisar locais"
        placeholder="Nome, endereço, bairro ou município"
        value={search}
        onChange={(event) => {
          setSearch(event.target.value);
          setPage(1);
        }}
      />
      {loading && <Loading />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {!loading && data?.items.length === 0 && (
        <EmptyState
          title="Nenhum local encontrado"
          description="Ajuste os filtros ou cadastre um local."
        />
      )}
      {data && data.items.length > 0 && (
        <>
          <div className={styles.table}>
            <table>
              <thead>
                <tr>
                  <th>Local</th>
                  <th>Zona</th>
                  <th>Município</th>
                  <th>Seções</th>
                  <th>Eleitores</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((place) => (
                  <tr key={place.id}>
                    <td>
                      <Link to={`/polling-places/${place.id}`}>
                        {place.name}
                      </Link>
                      <small>{place.address}</small>
                    </td>
                    <td>Zona {place.electoralZone.number}</td>
                    <td>{place.city}</td>
                    <td>{place.sectionCount}</td>
                    <td>{place.registeredVoters.toLocaleString("pt-BR")}</td>
                    <td>
                      <Badge
                        tone={
                          place.monitoringStatus === "CRITICAL" ||
                          place.monitoringStatus === "OFFLINE"
                            ? "danger"
                            : place.monitoringStatus === "ATTENTION"
                              ? "warning"
                              : "success"
                        }
                      >
                        {STATUS_LABELS[place.monitoringStatus]}
                      </Badge>
                    </td>
                    <td className={styles.actions}>
                      <Link to={`/polling-places/${place.id}/edit`}>
                        Editar
                      </Link>
                      <Button onClick={() => void remove(place.id)}>
                        Excluir
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={data.page}
            totalPages={data.totalPages}
            onChange={setPage}
          />
        </>
      )}
    </section>
  );
}
