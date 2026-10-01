import { ErrorState, Loading } from "@eops/ui";
import { CommunicationForm } from "../components/CommunicationForm";
import { useCommunicationForm } from "../hooks/useCommunicationForm";
import styles from "../styles/communications.module.css";

/**
 * Novo comunicado.
 *
 * Permite salvar como rascunho (`Salvar rascunho`) ou criar e publicar em um
 * único passo (`Salvar e publicar`), que é o caminho mais comum em operação.
 */
export function CommunicationCreatePage() {
  const controller = useCommunicationForm();
  const { references } = controller;

  if (references.loading) return <Loading label="Carregando formulário…" />;
  if (references.error || !references.data) {
    return (
      <ErrorState
        error={references.error ?? new Error("Dados de apoio indisponíveis.")}
        onRetry={references.reload}
      />
    );
  }

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>COMUNICAÇÕES</span>
          <h1>Novo comunicado</h1>
          <p>
            Defina prioridade, validade e público-alvo. O comunicado só alcança
            destinatários quando publicado.
          </p>
        </div>
      </header>
      <CommunicationForm
        value={controller.form}
        references={references.data}
        saving={controller.saving}
        error={controller.error}
        submitLabel="Salvar rascunho"
        onChange={controller.setForm}
        onSubmit={(publish) => void controller.submit(publish)}
        onCancel={controller.cancel}
      />
    </section>
  );
}
