import { useState } from "react";
import { EmptyState, ErrorState, LinkButton, Loading, Pagination, useAsync } from "@eops/ui";
import { EvidenceFilters } from "../components/EvidenceFilters";
import { EvidenceSummaryCards } from "../components/EvidenceSummaryCards";
import { EvidenceTable } from "../components/EvidenceTable";
import { useEvidenceList } from "../hooks/useEvidence";
import {
  evidenceService,
  type EvidenceFilters as Filters,
} from "../services/evidenceService";
import styles from "../styles/evidence.module.css";

const EMPTY: Filters = { page: 1, pageSize: 20 };

/**
 * Acervo de evidências: indicadores do repositório, filtros e tabela com
 * checksum da versão corrente de cada registro.
 */
export function EvidenceListPage() {
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const list = useEvidenceList(filters);
  const references = useAsync(() => evidenceService.referenceData(), []);
  const dashboard = useAsync(() => evidenceService.dashboard(filters.electionId), [filters.electionId]);

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>OPERAÇÕES</span>
          <h1>Documentos e Evidências</h1>
          <p>
            Repositório operacional com integridade verificável e versionamento que
            nunca sobrescreve o arquivo anterior.
          </p>
        </div>
        <div className={styles.headerActions}>
          <LinkButton to="/evidence/gallery" secondary>
            Galeria
          </LinkButton>
          <LinkButton to="/evidence/new">Nova evidência</LinkButton>
        </div>
      </header>

      {dashboard.data && <EvidenceSummaryCards dashboard={dashboard.data} />}

      <EvidenceFilters
        value={filters}
        references={references.data}
        onChange={setFilters}
        onReset={() => setFilters(EMPTY)}
      />

      {list.loading && <Loading label="Carregando acervo…" />}
      {list.error && <ErrorState error={list.error} onRetry={list.reload} />}

      {!list.loading && !list.error && list.data?.items.length === 0 && (
        <EmptyState
          title="Nenhuma evidência encontrada"
          description="Ajuste os filtros ou registre a primeira evidência da operação."
          action={<LinkButton to="/evidence/new">Nova evidência</LinkButton>}
        />
      )}

      {list.data && list.data.items.length > 0 && (
        <>
          <EvidenceTable items={list.data.items} />
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
