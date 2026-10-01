import { useState } from "react";
import { Card, ErrorState, LinkButton, Loading } from "@eops/ui";
import type { RiskMatrixCell, RiskSummary } from "@eops/shared/risks";
import { MatrixCellDetails, RiskMatrix } from "../components/RiskMatrix";
import { RiskTable } from "../components/RiskTable";
import { useRiskMatrix, useRiskList } from "../hooks/useRisks";
import styles from "../styles/risk.module.css";

/**
 * Matriz 5×5 interativa.
 *
 * Clicar em uma célula filtra a lista pela combinação de probabilidade e impacto
 * daquele quadrante — a leitura da matriz e a ação sobre ela acontecem na mesma
 * tela.
 */
export function RiskMatrixPage() {
  const [selected, setSelected] = useState<RiskMatrixCell>();
  // A matriz do painel mostra o acervo inteiro; a lista da célula aplica o recorte.
  const matrix = useRiskMatrix({});
  const cellRisks = useRiskList(
    selected
      ? {
          matrixProbability: selected.probability,
          matrixImpact: selected.impact,
          page: 1,
          pageSize: 20,
        }
      : { page: 1, pageSize: 1 },
  );

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>RISCOS</span>
          <h1>Matriz de risco</h1>
          <p>
            Probabilidade nas linhas, impacto nas colunas. Os números são contagens de
            riscos; a classificação de cada célula vem da mesma regra aplicada ao registro.
          </p>
        </div>
        <div className={styles.headerActions}>
          <LinkButton to="/risks" secondary>
            Painel
          </LinkButton>
          <LinkButton to="/risks/list" secondary>
            Lista
          </LinkButton>
          <LinkButton to="/risks/new">Novo risco</LinkButton>
        </div>
      </header>

      {matrix.loading && <Loading label="Montando matriz…" />}
      {matrix.error && <ErrorState error={matrix.error} onRetry={matrix.reload} />}

      {matrix.data && (
        <>
          <Card>
            <RiskMatrix
              matrix={matrix.data}
              onCellSelect={(cell) => setSelected(cell)}
            />
          </Card>

          {selected && (
            <>
              <MatrixCellDetails cell={selected} onClear={() => setSelected(undefined)} />
              {cellRisks.loading && <Loading label="Carregando riscos da célula…" />}
              {cellRisks.error && (
                <ErrorState error={cellRisks.error} onRetry={cellRisks.reload} />
              )}
              {cellRisks.data && cellRisks.data.items.length > 0 && (
                <RiskTable items={cellRisks.data.items as RiskSummary[]} />
              )}
            </>
          )}

          <Card>
            <h2>Sobre a leitura da matriz</h2>
            <p className={styles.mutedText}>
              A matriz é derivada do mesmo cálculo usado no registro do risco: o score é
              o produto dos valores da escala (1 a 5), e a faixa determina a
              classificação. Não existe uma segunda tabela de decisão que possa divergir
              do que está gravado.
            </p>
          </Card>
        </>
      )}
    </section>
  );
}
