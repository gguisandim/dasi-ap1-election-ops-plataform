import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ErrorState, LinkButton, Loading } from "@eops/ui";
import {
  KnowledgeArticleForm,
  emptyKnowledgeForm,
  type KnowledgeFormValue,
} from "../components/KnowledgeArticleForm";
import { KindBadge, StatusBadge } from "../components/KnowledgeBadges";
import { knowledgeService } from "../services/knowledgeService";
import {
  useKnowledgeArticle,
  useKnowledgeReferenceData,
} from "../hooks/useKnowledge";
import styles from "../styles/knowledge.module.css";

const EDITABLE = ["DRAFT", "REVIEW", "PUBLISHED"];

/**
 * Edição de verbete.
 *
 * Metadados, conteúdo e associação vão por `PATCH`; os passos são substituídos
 * por inteiro em uma segunda chamada. Cada alteração gera versão — a nota da
 * alteração é obrigatória quando o verbete já saiu do rascunho.
 */
export function KnowledgeEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const article = useKnowledgeArticle(id);
  const references = useKnowledgeReferenceData();
  const [form, setForm] = useState<KnowledgeFormValue>(emptyKnowledgeForm());
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<Error>();

  useEffect(() => {
    const data = article.data;
    if (!data) return;
    setForm({
      kind: data.kind,
      title: data.title,
      summary: data.summary,
      content: data.content ?? "",
      categoryId: data.categoryId ?? undefined,
      tags: data.tags.map((tag) => tag.label),
      incidentCategoryKey: data.incidentCategoryKey ?? undefined,
      incidentSeverity: data.incidentSeverity ?? undefined,
      assetTypeKey: data.assetTypeKey ?? undefined,
      keywords: data.keywords,
      problem: data.problem ?? "",
      symptoms: data.symptoms ?? "",
      diagnosis: data.diagnosis ?? "",
      prerequisites: data.prerequisites ?? "",
      validation: data.validation ?? "",
      rollback: data.rollback ?? "",
      escalation: data.escalation ?? "",
      references: data.references ?? "",
      changeNote: undefined,
      steps:
        data.kind === "RUNBOOK"
          ? (data.steps ?? []).map((step) => ({
              order: step.order,
              title: step.title,
              instruction: step.instruction,
              expected: step.expected ?? undefined,
              required: step.required,
              warning: step.warning ?? undefined,
              notes: step.notes ?? undefined,
            }))
          : [],
    });
    setHydrated(true);
  }, [article.data]);

  if (article.loading || references.loading) return <Loading label="Carregando verbete…" />;
  if (article.error || references.error) {
    return <ErrorState error={article.error ?? references.error} onRetry={article.reload} />;
  }
  const data = article.data;
  if (!data || !id || !references.data) {
    return <ErrorState error={new Error("Verbete não encontrado.")} />;
  }
  if (!EDITABLE.includes(data.status)) {
    return (
      <ErrorState
        error={new Error(
          "Verbetes arquivados são preservados apenas para consulta. Duplique o conteúdo em um novo verbete se precisar reativá-lo.",
        )}
      />
    );
  }
  if (!hydrated) return <Loading label="Preparando formulário…" />;

  const submit = async () => {
    setSaving(true);
    setError(undefined);
    try {
      await knowledgeService.update(id, {
        title: form.title,
        summary: form.summary,
        content: form.content || undefined,
        categoryId: form.categoryId,
        tags: form.tags,
        incidentCategoryKey: form.incidentCategoryKey,
        incidentSeverity: form.incidentSeverity,
        assetTypeKey: form.assetTypeKey,
        keywords: form.keywords,
        problem: form.problem || undefined,
        symptoms: form.symptoms || undefined,
        diagnosis: form.diagnosis || undefined,
        prerequisites: form.prerequisites || undefined,
        validation: form.validation || undefined,
        rollback: form.rollback || undefined,
        escalation: form.escalation || undefined,
        references: form.references || undefined,
        changeNote: form.changeNote,
      });
      if (form.kind === "RUNBOOK") {
        await knowledgeService.replaceSteps(id, form.steps);
      }
      navigate(`/knowledge/${id}`);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason : new Error("Não foi possível salvar as alterações."),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>VERBETE {data.code}</span>
          <h1>Editar verbete</h1>
          <div className={styles.badges}>
            <KindBadge kind={data.kind} />
            <StatusBadge status={data.status} />
          </div>
        </div>
        <div className={styles.headerActions}>
          <LinkButton to={`/knowledge/${data.id}/versions`} secondary>
            Versões
          </LinkButton>
          <LinkButton to={`/knowledge/${data.id}`} secondary>
            Ver verbete
          </LinkButton>
        </div>
      </header>

      <KnowledgeArticleForm
        value={form}
        references={references.data}
        saving={saving}
        error={error}
        editing
        submitLabel="Salvar alterações"
        onChange={setForm}
        onSubmit={() => void submit()}
        onCancel={() => navigate(`/knowledge/${id}`)}
      />
    </section>
  );
}
