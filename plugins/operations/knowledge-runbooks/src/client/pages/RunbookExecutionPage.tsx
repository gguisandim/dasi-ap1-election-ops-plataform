import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button, Card, ErrorState, Field, Input, LinkButton, Loading } from "@eops/ui";
import { KindBadge } from "../components/KnowledgeBadges";
import { RunbookStepList } from "../components/RunbookStepsEditor";
import {
  ExecutionProgress,
  OutcomeSelector,
} from "../components/RunbookExecutionPanel";
import { knowledgeService } from "../services/knowledgeService";
import { useKnowledgeArticle, useRunbookExecution } from "../hooks/useKnowledge";
import styles from "../styles/knowledge.module.css";

/**
 * Execução de runbook.
 *
 * O executor marca os passos cumpridos, declara o desfecho e registra o
 * incidente. Esse registro é o que alimenta taxa de sucesso, runbooks mais
 * utilizados e a ordenação das próximas recomendações.
 */
export function RunbookExecutionPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const article = useKnowledgeArticle(id);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<Error>();
  const [feedback, setFeedback] = useState<string>();

  const steps = article.data?.steps ?? [];
  const execution = useRunbookExecution(id, steps.length);

  if (article.loading) return <Loading label="Carregando runbook…" />;
  if (article.error) return <ErrorState error={article.error} onRetry={article.reload} />;
  const data = article.data;
  if (!data || !id) return <ErrorState error={new Error("Runbook não encontrado.")} />;
  if (data.kind !== "RUNBOOK") {
    return (
      <ErrorState
        error={new Error("Somente runbooks podem ser executados. Este verbete é um artigo.")}
        onRetry={() => undefined}
      />
    );
  }
  if (data.status !== "PUBLISHED") {
    return (
      <ErrorState
        error={new Error("Somente runbooks publicados podem ser executados.")}
        onRetry={() => undefined}
      />
    );
  }

  const register = async () => {
    setSaving(true);
    setError(undefined);
    await execution
      .submit((input) => knowledgeService.registerUsage(id, input))
      .then(() => {
        setFeedback("Execução registrada. O resultado entra nas métricas deste runbook.");
        article.reload();
      })
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason : new Error("Falha ao registrar a execução.")),
      )
      .finally(() => setSaving(false));
  };

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>EXECUÇÃO {data.code}</span>
          <h1>{data.title}</h1>
          <div className={styles.badges}>
            <KindBadge kind={data.kind} />
            <span className={styles.chip}>{steps.length} passo(s)</span>
          </div>
          <p>{data.summary}</p>
        </div>
        <div className={styles.headerActions}>
          <LinkButton to={`/knowledge/${data.id}`} secondary>
            Ver verbete
          </LinkButton>
        </div>
      </header>

      {error && <ErrorState error={error} />}
      {feedback && <p className={styles.successText}>{feedback}</p>}

      <div className={styles.executionGrid}>
        <div className={styles.detailMain}>
          <Card>
            <h2>Passos</h2>
            <ExecutionProgress
              completed={execution.completed.length}
              total={steps.length}
              progress={execution.progress}
            />
            <RunbookStepList
              steps={steps}
              completed={execution.completed}
              onToggle={execution.toggle}
            />
          </Card>
        </div>

        <div className={styles.detailSide}>
          <Card>
            <h2>Registro da execução</h2>
            <div className={styles.form}>
              <Field label="Incidente atendido (opcional)">
                <Input
                  placeholder="Identificador do incidente"
                  value={execution.incidentId}
                  onChange={(event) => execution.setIncidentId(event.target.value)}
                />
              </Field>
              <Field label="Resultado">
                <OutcomeSelector value={execution.outcome} onChange={execution.setOutcome} />
              </Field>
              <Field label="Observações">
                <textarea
                  className={styles.textareaSmall}
                  maxLength={1000}
                  placeholder="O que divergiu, o que faltou no procedimento"
                  value={execution.notes}
                  onChange={(event) => execution.setNotes(event.target.value)}
                />
              </Field>
              <Button disabled={saving} onClick={() => void register()}>
                {saving ? "Registrando…" : "Registrar execução"}
              </Button>
              <small className={styles.mutedText}>
                Desfechos negativos são tão úteis quanto positivos: eles apontam quais
                procedimentos precisam de revisão.
              </small>
            </div>
          </Card>

          {data.rollback && (
            <Card>
              <h2>Rollback</h2>
              <p className={styles.content}>{data.rollback}</p>
            </Card>
          )}
          {data.escalation && (
            <Card>
              <h2>Escalonamento</h2>
              <p className={styles.content}>{data.escalation}</p>
            </Card>
          )}
          {data.validation && (
            <Card>
              <h2>Validação</h2>
              <p className={styles.content}>{data.validation}</p>
            </Card>
          )}
        </div>
      </div>

      <footer className={styles.formFooter}>
        <Button type="button" onClick={() => navigate(`/knowledge/${data.id}`)}>
          Voltar ao verbete
        </Button>
      </footer>
    </section>
  );
}
