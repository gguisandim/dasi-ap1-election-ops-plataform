import { useState } from "react";
import { useParams } from "react-router-dom";
import { Card, ErrorState, LinkButton, Loading, useAsync } from "@eops/ui";
import { formatDateTime } from "@eops/shared/format";
import type { KnowledgeArticleVersionSummary } from "@eops/shared/knowledge";
import { VersionHistoryTable } from "../components/VersionHistoryTable";
import { knowledgeService } from "../services/knowledgeService";
import { useKnowledgeArticle } from "../hooks/useKnowledge";
import styles from "../styles/knowledge.module.css";

/**
 * Histórico de versões de um verbete.
 *
 * Cada versão é um instantâneo do texto e dos passos no momento da alteração.
 * O painel de leitura permite comparar mentalmente o que era com o que é, sem
 * que o histórico seja sobrescrito.
 */
export function KnowledgeVersionsPage() {
  const { id } = useParams<{ id: string }>();
  const article = useKnowledgeArticle(id);
  const versions = useAsync(
    () => (id ? knowledgeService.versions(id) : Promise.resolve([])),
    [id ?? ""],
  );
  const [preview, setPreview] = useState<KnowledgeArticleVersionSummary>();

  if (article.loading || versions.loading) return <Loading label="Carregando versões…" />;
  if (article.error || versions.error) {
    return <ErrorState error={article.error ?? versions.error} onRetry={versions.reload} />;
  }
  const data = article.data;
  if (!data || !id) return <ErrorState error={new Error("Verbete não encontrado.")} />;

  const list = versions.data ?? [];

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>VERBETE {data.code}</span>
          <h1>Versões</h1>
          <p>
            {list.length} versão(ões). O histórico guarda o texto e os passos como estavam
            em cada alteração.
          </p>
        </div>
        <div className={styles.headerActions}>
          <LinkButton to={`/knowledge/${data.id}`} secondary>
            Ver verbete
          </LinkButton>
          <LinkButton to={`/knowledge/${data.id}/edit`} secondary>
            Editar
          </LinkButton>
        </div>
      </header>

      <Card>
        <h2>Histórico</h2>
        <VersionHistoryTable
          versions={list}
          currentVersion={data.currentVersion}
          onPreview={setPreview}
        />
      </Card>

      {preview && (
        <Card>
          <h2>
            Conteúdo da versão {preview.number}
            <small className={styles.mutedText}>
              {" "}
              · {preview.authorName} · {formatDateTime(preview.createdAt)}
            </small>
          </h2>
          <h3>{preview.title}</h3>
          <p className={styles.summary}>{preview.summary}</p>
          {preview.content && <p className={styles.content}>{preview.content}</p>}
          {Array.isArray(preview.steps) && preview.steps.length > 0 && (
            <>
              <h3>Passos registrados nesta versão</h3>
              <ol className={styles.stepList}>
                {(preview.steps as Array<{ order: number; title: string; instruction: string }>).map(
                  (step) => (
                    <li key={step.order}>
                      <strong>
                        {step.order}. {step.title}
                      </strong>
                      <p>{step.instruction}</p>
                    </li>
                  ),
                )}
              </ol>
            </>
          )}
          <p className={styles.mutedText}>Nota da alteração: {preview.note}</p>
        </Card>
      )}
    </section>
  );
}
