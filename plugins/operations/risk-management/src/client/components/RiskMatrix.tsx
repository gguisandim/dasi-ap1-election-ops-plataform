import { Link } from "react-router-dom";
import {
  RISK_LEVEL_BANDS,
  RISK_LEVEL_LABELS,
  RISK_SCALE_LABELS,
  type RiskMatrixCell,
  type RiskScaleValue,
} from "@eops/shared/risks";
import styles from "../styles/risk.module.css";
import { LEVEL_CLASS } from "../utils/presentation";

/**
 * Matriz 5×5 de probabilidade × impacto.
 *
 * A classificação de cada célula vem do mesmo cálculo do registro — a matriz é
 * uma leitura da regra, não uma segunda tabela de decisão. Células com risco
 * levam à lista filtrada por aquela combinação.
 */
export function RiskMatrix({
  matrix,
  onCellSelect,
  compact = false,
}: {
  matrix: RiskMatrixCell[][];
  onCellSelect?: (cell: RiskMatrixCell) => void;
  compact?: boolean;
}) {
  // Linhas vêm da maior para a menor probabilidade; as colunas, do menor ao maior impacto.
  const impacts: RiskScaleValue[] = matrix[0]?.map((cell) => cell.impact) ?? [];

  return (
    <div className={styles.matrixWrap}>
      <div className={`${styles.matrix} ${compact ? styles.matrixCompact : ""}`}>
        <div className={styles.matrixCorner} aria-hidden="true">
          <span>Prob. ↓</span>
          <span>Impacto →</span>
        </div>
        {impacts.map((impact) => (
          <div key={impact} className={styles.matrixHeader}>
            {RISK_SCALE_LABELS[impact]}
          </div>
        ))}

        {matrix.map((row, rowIndex) => (
          <div key={`row-${rowIndex}`} className={styles.matrixRow}>
            <div className={styles.matrixHeader}>
              {RISK_SCALE_LABELS[row[0]?.probability ?? "MEDIUM"]}
            </div>
            {row.map((cell) => {
              const content = (
                <>
                  <strong>{cell.total > 0 ? cell.total : ""}</strong>
                  <small>{RISK_LEVEL_LABELS[cell.level]}</small>
                  <span className={styles.matrixScore}>{cell.score}</span>
                </>
              );
              return onCellSelect ? (
                <button
                  key={`${cell.probability}-${cell.impact}`}
                  type="button"
                  className={`${styles.matrixCell} ${styles[LEVEL_CLASS[cell.level]]} ${cell.total > 0 ? styles.matrixCellFilled : ""}`}
                  onClick={() => onCellSelect(cell)}
                  title={`Score ${cell.score} · ${RISK_LEVEL_LABELS[cell.level]}`}
                >
                  {content}
                </button>
              ) : (
                <div
                  key={`${cell.probability}-${cell.impact}`}
                  className={`${styles.matrixCell} ${styles[LEVEL_CLASS[cell.level]]} ${cell.total > 0 ? styles.matrixCellFilled : ""}`}
                >
                  {content}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <MatrixLegend />
    </div>
  );
}

/** Legenda com as faixas de score — a regra fica visível ao lado do desenho. */
export function MatrixLegend() {
  return (
    <div className={styles.matrixLegend}>
      <span className={styles.mutedText}>Faixas de score:</span>
      {RISK_LEVEL_BANDS.map((band, index) => {
        const min = index === 0 ? 1 : RISK_LEVEL_BANDS[index - 1].maxScore + 1;
        return (
          <span key={band.level} className={styles.legendItem}>
            <i className={styles[LEVEL_CLASS[band.level]]} />
            {RISK_LEVEL_LABELS[band.level]} ({min}–{band.maxScore})
          </span>
        );
      })}
    </div>
  );
}

/** Célula selecionada: lista os riscos daquela combinação de probabilidade e impacto. */
export function MatrixCellDetails({
  cell,
  onClear,
}: {
  cell: RiskMatrixCell;
  onClear: () => void;
}) {
  return (
    <div className={styles.matrixDetails}>
      <header>
        <div>
          <strong>
            Probabilidade {RISK_SCALE_LABELS[cell.probability]} × impacto{" "}
            {RISK_SCALE_LABELS[cell.impact]}
          </strong>
          <small>
            Score {cell.score} · {RISK_LEVEL_LABELS[cell.level]} · {cell.total} risco(s)
          </small>
        </div>
        <button type="button" onClick={onClear} aria-label="Fechar detalhe">
          ×
        </button>
      </header>
      {cell.total === 0 ? (
        <p className={styles.mutedText}>Nenhum risco nesta combinação.</p>
      ) : (
        <ul className={styles.cellList}>
          {cell.riskIds.map((riskId) => (
            <li key={riskId}>
              <Link to={`/risks/${riskId}`}>Abrir risco {riskId.slice(-6)}</Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
