import { Link } from "react-router-dom";
import type { RunbookRecommendation } from "@eops/shared/knowledge";
import { RUNBOOK_MATCH_WEIGHTS } from "@eops/shared/knowledge";
import styles from "../styles/knowledge.module.css";

/**
 * Runbooks recomendados com o score aberto.
 *
 * Cada resultado mostra os componentes que formaram a pontuação: a recomendação
 * é uma regra publicada, não uma caixa-preta, e o operador precisa poder
 * discordar dela com informação.
 */
export function RecommendationList({ items }: { items: RunbookRecommendation[] }) {
  if (items.length === 0) {
    return (
      <p className={styles.mutedText}>
        Nenhum runbook publicado corresponde aos critérios informados. Considere registrar
        um novo procedimento para esta categoria.
      </p>
    );
  }
  return (
    <ul className={styles.recommendationList}>
      {items.map((recommendation) => (
        <li key={recommendation.article.id}>
          <header>
            <div>
              <span className={styles.code}>{recommendation.article.code}</span>
              <strong>
                <Link to={`/knowledge/${recommendation.article.id}`}>
                  {recommendation.article.title}
                </Link>
              </strong>
            </div>
            <span className={styles.score} title="Pontuação de 0 a 100">
              {recommendation.score}
              <small>/100</small>
            </span>
          </header>
          <p className={styles.clamp}>{recommendation.article.summary}</p>
          <ul className={styles.reasonList}>
            {recommendation.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
          <footer>
            <span>
              {recommendation.article.stepCount ?? 0} passo(s) ·{" "}
              {recommendation.article.usageCount} uso(s) ·{" "}
              {recommendation.article.successRate}% de sucesso
            </span>
            <Link
              className={styles.inlineLink}
              to={`/knowledge/${recommendation.article.id}/execute`}
            >
              Executar runbook
            </Link>
          </footer>
        </li>
      ))}
    </ul>
  );
}

/** Legenda dos pesos, tornando a regra do score auditável na própria interface. */
export function ScoringLegend() {
  return (
    <dl className={styles.weights}>
      <dt>Categoria de incidente</dt>
      <dd>{RUNBOOK_MATCH_WEIGHTS.incidentCategory}</dd>
      <dt>Severidade</dt>
      <dd>{RUNBOOK_MATCH_WEIGHTS.severity}</dd>
      <dt>Tipo de ativo</dt>
      <dd>{RUNBOOK_MATCH_WEIGHTS.assetType}</dd>
      <dt>Palavra-chave presente</dt>
      <dd>
        {RUNBOOK_MATCH_WEIGHTS.keyword} cada, até {RUNBOOK_MATCH_WEIGHTS.keywordCap}
      </dd>
    </dl>
  );
}
