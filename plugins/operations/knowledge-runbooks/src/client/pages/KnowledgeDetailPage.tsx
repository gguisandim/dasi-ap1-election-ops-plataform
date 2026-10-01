import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button, Card, ErrorState, Input, LinkButton, Loading, useAsync } from "@eops/ui";
import { formatDateTime } from "@eops/shared/format";
import { KindBadge, KnowledgeChip, StatusBadge } from "../components/KnowledgeBadges";
import { RunbookStepList } from "../components/RunbookStepsEditor";
import { UsageHistoryTable } from "../components/UsageHistoryTable";
import { knowledgeService } from "../services/knowledgeService";
import { useKnowledgeArticle } from "../hooks/useKnowledge";
import styles from "../styles/knowledge.module.css";

/**
 * Detalhe do verbete.
 *
 * Runbooks mostram os passos na ordem de execução; artigos mostram o conteúdo.
 * O painel lateral concentra procedência, associação ao incidente e ações de
 * ciclo de vida.
 */
export function KnowledgeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const article = useKnowledgeArticle(id);
  const usages = useAsync(
    () => (id ? knowledgeService.usagesFor(id) : Promise.resolve([])),
    [id ?? ""],
  );
  const [feedback, setFeedback] = useState<string>();
  const [error, setError] = useState<Error>();

  if (article.loading) return <Loading label="Carregando verbete…" />;
  if (article.error) return <ErrorState error={article.error} onRetry={article.reload} />;
  const data = article.data;
  if (!data || !id) return <ErrorState error={new Error("Verbete não encontrado.")} />;

  const act = async (operation: () => Promise<unknown>, message: string) => {
    setError(undefined);
    setFeedback(undefined);
    try {
      await operation();
      setFeedback(message);
      article.reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason : new Error("Operação não concluída."));
    }
  };

  const isRunbook = data.kind === "RUNBOOK";

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>VERBETE {data.code}</span>
          <h1>{data.title}</h1>
          <div className={styles.badges}>
            <KindBadge kind={data.kind} />
            <StatusBadge status={data.status} />
            {isRunbook && <KnowledgeChip label={`${data.stepCount ?? 0} passo(s)`} />}
            {isRunbook && data.usageCount > 0 && (
              <KnowledgeChip label={`${data.successRate}% de sucesso`} />
            )}
            {data.stale && <KnowledgeChip label="desatualizado" icon="!" />}
          </div>
          <p className={styles.summary}>{data.summary}</p>
        </div>
        <div className={styles.headerActions}>
          {isRunbook && data.status === "PUBLISHED" && (
            <LinkButton to={`/knowledge/${data.id}/execute`}>Executar</LinkButton>
          )}
          <LinkButton to={`/knowledge/${data.id}/versions`} secondary>
            Versões
          </LinkButton>
          {data.status !== "ARCHIVED" && (
            <LinkButton to={`/knowledge/${data.id}/edit`} secondary>
              Editar
            </LinkButton>
          )}
        </div>
      </header>

      {error && <ErrorState error={error} />}
      {feedback && <p className={styles.successText}>{feedback}</p>}

      <div className={styles.detailGrid}>
        <div className={styles.detailMain}>
          {isRunbook ? (
            <>
              <Card>
                <h2>Problema</h2>
                <p className={styles.content}>{data.problem ?? "—"}</p>
                {data.symptoms && (
                  <>
                    <h3>Sintomas observáveis</h3>
                    <p className={styles.content}>{data.symptoms}</p>
                  </>
                )}
                {data.diagnosis && (
                  <>
                    <h3>Diagnóstico</h3>
                    <p className={styles.content}>{data.diagnosis}</p>
                  </>
                )}
                {data.prerequisites && (
                  <>
                    <h3>Pré-requisitos</h3>
                    <p className={styles.content}>{data.prerequisites}</p>
                  </>
                )}
              </Card>

              <Card>
                <h2>Passos</h2>
                <RunbookStepList steps={data.steps ?? []} />
              </Card>

              {(data.validation || data.rollback || data.escalation) && (
                <Card>
                  <h2>Validação, rollback e escalonamento</h2>
                  {data.validation && (
                    <>
                      <h3>Validação</h3>
                      <p className={styles.content}>{data.validation}</p>
                    </>
                  )}
                  {data.rollback && (
                    <>
                      <h3>Rollback</h3>
                      <p className={styles.content}>{data.rollback}</p>
                    </>
                  )}
                  {data.escalation && (
                    <>
                      <h3>Escalonamento</h3>
                      <p className={styles.content}>{data.escalation}</p>
                    </>
                  )}
                </Card>
              )}
            </>
          ) : (
            <Card>
              <h2>Conteúdo</h2>
              <p className={styles.content}>{data.content ?? "—"}</p>
            </Card>
          )}

          {isRunbook && (
            <Card>
              <h2>Histórico de execuções</h2>
              <UsageHistoryTable
                items={usages.data ?? []}
                emptyLabel="Este runbook ainda não foi executado."
              />
            </Card>
          )}
        </div>

        <div className={styles.detailSide}>
          <Card>
            <h2>Associação</h2>
            <dl className={styles.metaList}>
              <dt>Categoria de incidente</dt>
              <dd>{data.incidentCategoryKey ?? "—"}</dd>
              <dt>Severidade alvo</dt>
              <dd>{data.incidentSeverity ?? "qualquer"}</dd>
              <dt>Tipo de ativo</dt>
              <dd>{data.assetTypeKey ?? "—"}</dd>
              <dt>Palavras-chave</dt>
              <dd>{data.keywords.length > 0 ? data.keywords.join(", ") : "—"}</dd>
            </dl>
            <small className={styles.mutedText}>
              Estes campos alimentam o score de recomendação a partir do incidente.
            </small>
          </Card>

          <Card>
            <h2>Procedência</h2>
            <dl className={styles.metaList}>
              <dt>Categoria</dt>
              <dd>{data.category?.name ?? "Sem categoria"}</dd>
              <dt>Autor</dt>
              <dd>{data.authorName}</dd>
              <dt>Versão</dt>
              <dd>
                v{data.currentVersion} de {data.versionCount}
              </dd>
              <dt>Leituras</dt>
              <dd>{data.views}</dd>
              {isRunbook && (
                <>
                  <dt>Execuções</dt>
                  <dd>
                    {data.usageCount} · {data.resolvedCount} resolvida(s)
                  </dd>
                </>
              )}
              <dt>Criado em</dt>
              <dd>{formatDateTime(data.createdAt)}</dd>
              <dt>Publicado em</dt>
              <dd>{data.publishedAt ? formatDateTime(data.publishedAt) : "—"}</dd>
              <dt>Atualizado em</dt>
              <dd>{formatDateTime(data.updatedAt)}</dd>
            </dl>
            {data.tags.length > 0 && (
              <>
                <h3>Etiquetas</h3>
                <div className={styles.tagList}>
                  {data.tags.map((tag) => (
                    <Link key={tag.id} className={styles.tag} to={`/knowledge?tag=${tag.slug}`}>
                      {tag.label}
                    </Link>
                  ))}
                </div>
              </>
            )}
            {data.references && (
              <>
                <h3>Referências</h3>
                <p className={styles.content}>{data.references}</p>
              </>
            )}
          </Card>

          <Card>
            <h2>Ações</h2>
            <div className={styles.actions}>
              {data.status === "DRAFT" && (
                <Button
                  onClick={() => void act(() => knowledgeService.review(id), "Enviado para revisão.")}
                >
                  Enviar para revisão
                </Button>
              )}
              {(data.status === "DRAFT" || data.status === "REVIEW") && (
                <Button
                  onClick={() => void act(() => knowledgeService.publish(id), "Verbete publicado.")}
                >
                  Publicar
                </Button>
              )}
              {data.status !== "ARCHIVED" && (
                <Button
                  onClick={() => void act(() => knowledgeService.archive(id), "Verbete arquivado.")}
                >
                  Arquivar
                </Button>
              )}
              {data.status === "DRAFT" && (
                <Button
                  onClick={() => {
                    if (!window.confirm("Excluir este rascunho definitivamente?")) return;
                    void knowledgeService
                      .remove(id)
                      .then(() => navigate("/knowledge"))
                      .catch((reason: unknown) =>
                        setError(
                          reason instanceof Error ? reason : new Error("Não foi possível excluir."),
                        ),
                      );
                  }}
                >
                  Excluir rascunho
                </Button>
              )}
              <small className={styles.mutedText}>
                Publicar exige resumo e, em runbooks, ao menos um passo.
              </small>
            </div>
          </Card>

          <RunbookTester
            runbookId={id}
            disabled={!isRunbook || data.status !== "PUBLISHED"}
          />
        </div>
      </div>
    </section>
  );
}

/**
 * Teste rápido de recomendação para o próprio verbete.
 *
 * Serve para a curadoria responder "este runbook seria sugerido para o incidente
 * X?" sem sair da página nem abrir a tela de recomendações.
 */
function RunbookTester({ runbookId, disabled }: { runbookId: string; disabled: boolean }) {
  const [incidentId, setIncidentId] = useState("");
  const [result, setResult] = useState<{ score: number; reasons: string[] }>();
  const [error, setError] = useState<string>();
  const references = useAsync(() => knowledgeService.referenceData(), []);

  if (disabled) return null;

  return (
    <Card>
      <h2>Testar recomendação</h2>
      <p className={styles.mutedText}>
        Verifique com qual pontuação este runbook seria sugerido para um incidente.
      </p>
      <Input
        aria-label="Incidente para testar"
        placeholder="Identificador do incidente"
        value={incidentId}
        onChange={(event) => setIncidentId(event.target.value)}
      />
      {references.data && references.data.incidents.length > 0 && (
        <select
          className={styles.incidentSelect}
          aria-label="Incidentes abertos"
          value={incidentId}
          onChange={(event) => setIncidentId(event.target.value)}
        >
          <option value="">Selecione um incidente aberto</option>
          {references.data.incidents.map((incident) => (
            <option key={incident.id} value={incident.id}>
              {incident.code} · {incident.title}
            </option>
          ))}
        </select>
      )}
      <Button
        disabled={!incidentId}
        onClick={() => {
          setError(undefined);
          setResult(undefined);
          void knowledgeService
            .recommendations({ incidentId, limit: 20 })
            .then((items) => {
              const match = items.find((item) => item.article.id === runbookId);
              if (!match) {
                setError("Este runbook não seria recomendado para o incidente informado.");
                return;
              }
              setResult({ score: match.score, reasons: match.reasons });
            })
            .catch((reason: unknown) =>
              setError(reason instanceof Error ? reason.message : "Falha ao consultar."),
            );
        }}
      >
        Calcular score
      </Button>
      {error && <p className={styles.dangerText}>{error}</p>}
      {result && (
        <div className={styles.testResult}>
          <strong>{result.score}/100</strong>
          <ul className={styles.reasonList}>
            {result.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
