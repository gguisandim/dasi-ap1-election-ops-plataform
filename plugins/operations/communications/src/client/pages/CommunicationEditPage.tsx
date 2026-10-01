import { useParams } from "react-router-dom";
import { ErrorState, LinkButton, Loading } from "@eops/ui";
import { CommunicationForm } from "../components/CommunicationForm";
import { useCommunicationForm } from "../hooks/useCommunicationForm";
import { PriorityBadge, StatusBadge } from "../components/CommunicationBadges";
import styles from "../styles/communications.module.css";

/** Status em que o conteúdo ainda pode ser alterado. */
const EDITABLE_STATUSES = ["DRAFT", "SCHEDULED", "PUBLISHED"];

/**
 * Edição de comunicado.
 *
 * Alterar o direcionamento de um comunicado publicado rematerializa os
 * destinatários, preservando quem já leu ou confirmou.
 */
export function CommunicationEditPage() {
  const { id } = useParams<{ id: string }>();
  const controller = useCommunicationForm(id);
  const { references, current } = controller;

  if (current.loading || references.loading) {
    return <Loading label="Carregando comunicado…" />;
  }
  if (current.error || references.error) {
    return (
      <ErrorState
        error={current.error ?? references.error}
        onRetry={current.reload}
      />
    );
  }
  if (!current.data || !references.data) {
    return <ErrorState error={new Error("Comunicado não encontrado.")} />;
  }
  if (!EDITABLE_STATUSES.includes(current.data.status)) {
    return (
      <ErrorState
        error={
          new Error(
            "Comunicados expirados, arquivados ou cancelados são preservados apenas para consulta.",
          )
        }
        onRetry={() => undefined}
      />
    );
  }
  if (!controller.hydrated) return <Loading label="Preparando formulário…" />;

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>COMUNICAÇÃO {current.data.code}</span>
          <h1>Editar comunicado</h1>
          <div className={styles.badges}>
            <PriorityBadge priority={current.data.priority} />
            <StatusBadge status={current.data.status} />
          </div>
        </div>
        <div className={styles.headerActions}>
          <LinkButton to={`/communications/messages/${current.data.id}`} secondary>
            Ver detalhe
          </LinkButton>
        </div>
      </header>
      <CommunicationForm
        value={controller.form}
        references={references.data}
        saving={controller.saving}
        error={controller.error}
        submitLabel="Salvar alterações"
        onChange={controller.setForm}
        onSubmit={(publish) => void controller.submit(publish)}
        onCancel={controller.cancel}
      />
    </section>
  );
}
