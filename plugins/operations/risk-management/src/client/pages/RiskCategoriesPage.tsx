import { useState } from "react";
import { ErrorState, LinkButton, Loading } from "@eops/ui";
import type { RiskCategorySummary } from "@eops/shared/risks";
import { CategoryManager } from "../components/CategoryManager";
import { riskService } from "../services/riskService";
import { useRiskCategories } from "../hooks/useRisks";
import styles from "../styles/risk.module.css";

/**
 * Categorias de risco.
 *
 * Cadastráveis pela operação: energia, conectividade, logística, segurança,
 * pessoal e o que mais o pleito exigir.
 */
export function RiskCategoriesPage() {
  const categories = useRiskCategories();
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
          <span className={styles.eyebrow}>RISCOS</span>
          <h1>Categorias de risco</h1>
          <p>A categoria agrupa os riscos e alimenta a distribuição do painel.</p>
        </div>
        <div className={styles.headerActions}>
          <LinkButton to="/risks" secondary>
            Painel
          </LinkButton>
        </div>
      </header>

      {error && <ErrorState error={error} />}
      {feedback && <p className={styles.successText}>{feedback}</p>}

      <CategoryManager
        categories={
          (categories.data ?? []) as Array<
            RiskCategorySummary & { _count?: { risks: number } }
          >
        }
        saving={saving}
        onCreate={(input) =>
          void run(() => riskService.createCategory(input), "Categoria criada.")
        }
        onToggle={(category) =>
          void run(
            () => riskService.updateCategory(category.id, { active: !category.active }),
            category.active ? "Categoria inativada." : "Categoria ativada.",
          )
        }
        onRename={(category, name) =>
          void run(
            () => riskService.updateCategory(category.id, { name }),
            "Categoria renomeada.",
          )
        }
      />
    </section>
  );
}
