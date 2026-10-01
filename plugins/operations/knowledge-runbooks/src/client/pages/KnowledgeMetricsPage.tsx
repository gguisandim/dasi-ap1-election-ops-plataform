import { Card, ErrorState, LinkButton, Loading } from "@eops/ui";
import { formatDateTime, formatPercent } from "@eops/shared/format";
import { useKnowledgeMetrics } from "../hooks/useKnowledge";
import styles from "../styles/knowledge.module.css";

/**
 * Métricas de uso e curadoria.
 *
 * Responde às quatro perguntas que orientam a manutenção da base: o que mais é
 * usado, o que realmente resolve, onde falta cobertura e o que está
 * desatualizado ou sem uso.
 */
export function KnowledgeMetricsPage() {
  const metrics = useKnowledgeMetrics();

  if (metrics.loading) return <Loading label="Calculando métricas…" />;
  if (metrics.error) return <ErrorState error={metrics.error} onRetry={metrics.reload} />;
  const data = metrics.data;
  if (!data) return <ErrorState error={new Error("Métricas indisponíveis.")} />;

  const maxCoverage = Math.max(1, ...data.coverage.map((entry) => entry.runbooks));

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>CONHECIMENTO</span>
          <h1>Métricas da base</h1>
          <p>
            Uso, eficácia e cobertura. Um runbook nunca executado ou com baixa taxa de
            sucesso é uma pista de curadoria, não um sucesso silencioso.
          </p>
        </div>
        <div className={styles.headerActions}>
          <LinkButton to="/knowledge" secondary>
            Voltar à base
          </LinkButton>
        </div>
      </header>

      <div className={styles.outcomeCards}>
        <Card>
          <span>Execuções registradas</span>
          <strong>{data.outcomes.total}</strong>
          <small>{formatPercent(data.outcomes.successRate)} resolveram o incidente</small>
        </Card>
        <Card>
          <span>Resolvido</span>
          <strong>{data.outcomes.resolved}</strong>
          <small>{data.outcomes.partiallyResolved} parcial(is)</small>
        </Card>
        <Card>
          <span>Não resolvido</span>
          <strong>{data.outcomes.notResolved}</strong>
          <small>Candidatos a revisão do procedimento</small>
        </Card>
      </div>

      <div className={styles.metricsGrid}>
        <Card>
          <h2>Runbooks mais utilizados</h2>
          {data.mostUsed.length === 0 && (
            <p className={styles.mutedText}>Nenhuma execução registrada ainda.</p>
          )}
          {data.mostUsed.length > 0 && (
            <div className={styles.tableWrap}>
              <table>
                <thead>
                  <tr>
                    <th>Runbook</th>
                    <th>Execuções</th>
                    <th>Resoluções</th>
                    <th>Taxa de sucesso</th>
                    <th>Atualizado em</th>
                  </tr>
                </thead>
                <tbody>
                  {data.mostUsed.map((article) => (
                    <tr key={article.id}>
                      <td>
                        <strong>{article.title}</strong>
                        <small>{article.code}</small>
                      </td>
                      <td>{article.usageCount}</td>
                      <td>{article.resolvedCount}</td>
                      <td>
                        <div className={styles.rateBar}>
                          <span style={{ width: `${article.successRate}%` }} />
                        </div>
                        <small>{formatPercent(article.successRate)}</small>
                      </td>
                      <td>{formatDateTime(article.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card>
          <h2>Cobertura por categoria</h2>
          <p className={styles.mutedText}>
            Categorias no topo têm menos runbooks publicados — são a fila de curadoria.
          </p>
          <ul className={styles.coverageList}>
            {data.coverage.map((entry) => (
              <li key={entry.categoryId ?? "none"}>
                <span>{entry.name}</span>
                <div className={styles.coverageBar}>
                  <span style={{ width: `${(entry.runbooks / maxCoverage) * 100}%` }} />
                </div>
                <strong>{entry.runbooks}</strong>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <h2>Publicados sem uso</h2>
          {data.unused.length === 0 ? (
            <p className={styles.mutedText}>
              Todo runbook publicado já foi executado ao menos uma vez.
            </p>
          ) : (
            <ul className={styles.simpleList}>
              {data.unused.map((article) => (
                <li key={article.id}>
                  <span>{article.title}</span>
                  <small>
                    publicado em{" "}
                    {article.publishedAt ? formatDateTime(article.publishedAt) : "—"}
                  </small>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2>Desatualizados</h2>
          {data.stale.length === 0 ? (
            <p className={styles.mutedText}>
              Nenhum runbook publicado sem atualização há mais de 180 dias.
            </p>
          ) : (
            <ul className={styles.simpleList}>
              {data.stale.map((article) => (
                <li key={article.id}>
                  <span>{article.title}</span>
                  <small>atualizado em {formatDateTime(article.updatedAt)}</small>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </section>
  );
}
