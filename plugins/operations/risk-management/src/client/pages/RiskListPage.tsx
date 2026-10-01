import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { EmptyState, ErrorState, LinkButton, Loading, Pagination } from "@eops/ui";
import { RiskFilters } from "../components/RiskFilters";
import { RiskTable } from "../components/RiskTable";
import { useRiskList, useRiskReferenceData } from "../hooks/useRisks";
import type { RiskFilters as Filters } from "../services/riskService";
import styles from "../styles/risk.module.css";

const EMPTY: Filters = { page: 1, pageSize: 20 };

/**
 * Lista filtrável de riscos.
 *
 * Aceita `?level=`, `?status=` e o par `matrixProbability/matrixImpact`, que é como
 * a matriz do painel encaminha o clique em uma célula.
 */
export function RiskListPage() {
  const [searchParams] = useSearchParams();
  const [filters, setFilters] = useState<Filters>({
    ...EMPTY,
    level: (searchParams.get("level") as Filters["level"]) ?? undefined,
    status: (searchParams.get("status") as Filters["status"]) ?? undefined,
    matrixProbability:
      (searchParams.get("matrixProbability") as Filters["matrixProbability"]) ?? undefined,
    matrixImpact: (searchParams.get("matrixImpact") as Filters["matrixImpact"]) ?? undefined,
  });
  const list = useRiskList(filters);
  const references = useRiskReferenceData();

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>RISCOS</span>
          <h1>Lista de riscos</h1>
          <p>
            {list.data?.total ?? 0} risco(s) encontrado(s), ordenados por classificação e
            score.
          </p>
        </div>
        <div className={styles.headerActions}>
          <LinkButton to="/risks" secondary>
            Painel
          </LinkButton>
          <LinkButton to="/risks/matrix" secondary>
            Matriz
          </LinkButton>
          <LinkButton to="/risks/new">Novo risco</LinkButton>
        </div>
      </header>

      <RiskFilters
        value={filters}
        references={references.data}
        onChange={setFilters}
        onReset={() => setFilters(EMPTY)}
      />

      {list.loading && <Loading label="Carregando riscos…" />}
      {list.error && <ErrorState error={list.error} onRetry={list.reload} />}

      {!list.loading && !list.error && list.data?.items.length === 0 && (
        <EmptyState
          title="Nenhum risco encontrado"
          description="Ajuste os filtros ou registre um novo risco operacional."
          action={<LinkButton to="/risks/new">Novo risco</LinkButton>}
        />
      )}

      {list.data && list.data.items.length > 0 && (
        <>
          <RiskTable items={list.data.items} />
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
