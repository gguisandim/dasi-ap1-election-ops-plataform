import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ErrorState, Loading } from "@eops/ui";
import type { KnowledgeArticleKind } from "@eops/shared/knowledge";
import {
  KnowledgeArticleForm,
  emptyKnowledgeForm,
  type KnowledgeFormValue,
} from "../components/KnowledgeArticleForm";
import { knowledgeService } from "../services/knowledgeService";
import { useKnowledgeReferenceData } from "../hooks/useKnowledge";
import styles from "../styles/knowledge.module.css";

/**
 * Novo verbete.
 *
 * Aceita `?kind=RUNBOOK` para que a tela de recomendações possa abrir
 * diretamente o formulário de runbook com os campos próprios visíveis.
 */
export function KnowledgeCreatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const references = useKnowledgeReferenceData();
  const initialKind = (searchParams.get("kind") as KnowledgeArticleKind | null) ?? "ARTICLE";
  const [form, setForm] = useState<KnowledgeFormValue>(emptyKnowledgeForm(initialKind));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<Error>();

  if (references.loading) return <Loading label="Carregando formulário…" />;
  if (references.error || !references.data) {
    return (
      <ErrorState
        error={references.error ?? new Error("Dados de apoio indisponíveis.")}
        onRetry={references.reload}
      />
    );
  }

  const submit = async () => {
    setSaving(true);
    setError(undefined);
    try {
      const created = await knowledgeService.create({
        ...form,
        steps: form.kind === "RUNBOOK" ? form.steps : undefined,
      });
      // Os passos vão em chamada própria para que a criação não dependa do
      // processamento da lista inteira em um único payload.
      if (form.kind === "RUNBOOK" && form.steps.length > 0) {
        await knowledgeService.replaceSteps(created.id, form.steps);
      }
      navigate(`/knowledge/${created.id}`);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason : new Error("Não foi possível salvar o verbete."),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>CONHECIMENTO</span>
          <h1>Novo verbete</h1>
          <p>
            Um runbook descreve o problema, os sintomas, os passos e como validar a
            resolução. A associação com categoria, severidade e palavras-chave é o que
            permite recomendá-lo ao incidente certo.
          </p>
        </div>
      </header>

      <KnowledgeArticleForm
        value={form}
        references={references.data}
        saving={saving}
        error={error}
        editing={false}
        submitLabel="Salvar rascunho"
        onChange={setForm}
        onSubmit={() => void submit()}
        onCancel={() => navigate("/knowledge")}
      />
    </section>
  );
}
