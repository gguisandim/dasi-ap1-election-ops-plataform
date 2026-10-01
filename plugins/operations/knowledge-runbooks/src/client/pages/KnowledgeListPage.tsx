import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { EmptyState, ErrorState, LinkButton, Loading, Pagination } from "@eops/ui";
import { KnowledgeFilters } from "../components/KnowledgeFilters";
import { KnowledgeSummaryCards } from "../components/KnowledgeSummaryCards";
import { KnowledgeTable } from "../components/KnowledgeTable";
import {
  useKnowledgeDashboard,
  useKnowledgeList,
  useKnowledgeReferenceData,
} from "../hooks/useKnowledge";
import type { KnowledgeFilters as Filters } from "../services/knowledgeService";
import styles from "../styles/knowledge.module.css";

const EMPTY: Filters = { page: 1, pageSize: 20 };

/** Base de conhecimento: indicadores, busca textual e tabela de verbetes. */
export function KnowledgeListPage() {
  const [searchParams] = useSearchParams();
  const [filters, setFilters] = useState<Filters>({
    ...EMPTY,
    search: searchParams.get("search") ?? undefined,
    kind: (searchParams.get("kind") as Filters["kind"]) ?? undefined,
  });

  const list = useKnowledgeList(filters);
  const dashboard = useKnowledgeDashboard();
  const references = useKnowledgeReferenceData();

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>OPERAÇÕES</span>
          <h1>Base de Conhecimento</h1>
          <p>
            Procedimentos operacionais e soluções conhecidas, com passos estruturados e
            recomendação automática a partir do incidente.
          </p>
        </div>
        <div className={styles.headerActions}>
          <LinkButton to="/knowledge/recommendations" secondary>
            Recomendações
          </LinkButton>
          <LinkButton to="/knowledge/metrics" secondary>
            Métricas
          </LinkButton>
          <LinkButton to="/knowledge/categories" secondary>
            Categorias
          </LinkButton>
          <LinkButton to="/knowledge/new">Novo verbete</LinkButton>
        </div>
      </header>

      {dashboard.data && <KnowledgeSummaryCards dashboard={dashboard.data} />}

      <KnowledgeFilters
        value={filters}
        references={references.data}
        onChange={setFilters}
        onReset={() => setFilters(EMPTY)}
      />

      {list.loading && <Loading label="Carregando base…" />}
      {list.error && <ErrorState error={list.error} onRetry={list.reload} />}

      {!list.loading && !list.error && list.data?.items.length === 0 && (
        <EmptyState
          title="Nenhum verbete encontrado"
          description="Ajuste os filtros ou registre o primeiro procedimento operacional."
          action={<LinkButton to="/knowledge/new">Novo verbete</LinkButton>}
        />
      )}

      {list.data && list.data.items.length > 0 && (
        <>
          <KnowledgeTable items={list.data.items} />
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
