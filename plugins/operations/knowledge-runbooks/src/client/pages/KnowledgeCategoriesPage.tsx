import { useState } from "react";
import { ErrorState, LinkButton, Loading, useAsync } from "@eops/ui";
import type { KnowledgeCategorySummary } from "@eops/shared/knowledge";
import { CategoryManager } from "../components/CategoryManager";
import { knowledgeService } from "../services/knowledgeService";
import styles from "../styles/knowledge.module.css";

/**
 * Categorias da base.
 *
 * Cadastráveis pela própria operação: conectividade, hardware, transmissão,
 * energia, logística, software e autenticação são apenas os pontos de partida.
 */
export function KnowledgeCategoriesPage() {
  const categories = useAsync(() => knowledgeService.categories(), []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<Error>();
  const [feedback, setFeedback] = useState<string>();

  const run = async (operation: () => Promise<unknown>, message: string) => {
    setSaving(true);
    setError(undefined);
    setFeedback(undefined);
    try {
      await operation();
      setFeedback(message);
      categories.reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason : new Error("Operação não concluída."));
    } finally {
      setSaving(false);
    }
  };

  if (categories.loading) return <Loading label="Carregando categorias…" />;
  if (categories.error) {
    return <ErrorState error={categories.error} onRetry={categories.reload} />;
  }

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>CONHECIMENTO</span>
          <h1>Categorias</h1>
          <p>
            A categoria agrupa procedimentos e alimenta a cobertura de runbooks por área.
          </p>
        </div>
        <div className={styles.headerActions}>
          <LinkButton to="/knowledge" secondary>
            Voltar à base
          </LinkButton>
        </div>
      </header>

      {error && <ErrorState error={error} />}
      {feedback && <p className={styles.successText}>{feedback}</p>}

      <CategoryManager
        categories={
          (categories.data ?? []) as Array<
            KnowledgeCategorySummary & { _count?: { articles: number } }
          >
        }
        saving={saving}
        onCreate={(input) =>
          void run(() => knowledgeService.createCategory(input), "Categoria criada.")
        }
        onToggle={(category) =>
          void run(
            () => knowledgeService.updateCategory(category.id, { active: !category.active }),
            category.active ? "Categoria inativada." : "Categoria ativada.",
          )
        }
        onRename={(category, name) =>
          void run(
            () => knowledgeService.updateCategory(category.id, { name }),
            "Categoria renomeada.",
          )
        }
      />
    </section>
  );
}
