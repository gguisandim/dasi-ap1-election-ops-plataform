import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  EmptyState,
  ErrorState,
  LinkButton,
  Loading,
  Pagination,
  useAsync,
} from "@eops/ui";
import { CommunicationFilters } from "../components/CommunicationFilters";
import { CommunicationTable } from "../components/CommunicationTable";
import {
  communicationService,
  type CommunicationFilters as Filters,
} from "../services/communicationService";
import type { CommunicationStatus } from "@eops/shared/communications";
import styles from "../styles/communications.module.css";

const EMPTY_FILTERS: Filters = { page: 1, pageSize: 20 };

export function CommunicationListPage() {
  const [searchParams] = useSearchParams();
  const [filters, setFilters] = useState<Filters>({
    ...EMPTY_FILTERS,
    status: (searchParams.get("status") as CommunicationStatus | null) ?? undefined,
    electionId: searchParams.get("electionId") ?? undefined,
  });
  const key = JSON.stringify(filters);
  const list = useAsync(() => communicationService.list(filters), [key]);
  const references = useAsync(() => communicationService.referenceData(), []);

  const total = list.data?.total ?? 0;

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>COMUNICAÇÕES</span>
          <h1>Comunicados</h1>
          <p>
            {total} comunicado(s) encontrado(s). Prioridades alta e crítica aparecem
            destacadas.
          </p>
        </div>
        <div className={styles.headerActions}>
          <LinkButton to="/communications/templates" secondary>
            Templates
          </LinkButton>
          <LinkButton to="/communications/messages/new">Novo comunicado</LinkButton>
        </div>
      </header>

      <CommunicationFilters
        value={filters}
        categories={references.data?.categories ?? []}
        tags={references.data?.tags ?? []}
        elections={references.data?.elections ?? []}
        onChange={setFilters}
        onReset={() => setFilters(EMPTY_FILTERS)}
      />

      {list.loading && <Loading label="Carregando comunicados…" />}
      {list.error && <ErrorState error={list.error} onRetry={list.reload} />}

      {!list.loading && !list.error && list.data?.items.length === 0 && (
        <EmptyState
          title="Nenhum comunicado encontrado"
          description="Ajuste os filtros ou crie um novo comunicado operacional."
          action={<LinkButton to="/communications/messages/new">Novo comunicado</LinkButton>}
        />
      )}

      {list.data && list.data.items.length > 0 && (
        <>
          <CommunicationTable items={list.data.items} />
          <Pagination
            page={list.data.page}
            totalPages={list.data.totalPages}
            onChange={(page) => setFilters((current) => ({ ...current, page }))}
          />
        </>
      )}
    </section>
  );
}
