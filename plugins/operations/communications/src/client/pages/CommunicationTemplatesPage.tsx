import { useState } from "react";
import { Button, Card, EmptyState, ErrorState, Loading, useAsync } from "@eops/ui";
import type { CommunicationTemplateSummary } from "@eops/shared/communications";
import { TemplateForm, templateToInput } from "../components/TemplateForm";
import { TemplateList } from "../components/TemplateList";
import {
  communicationService,
  type TemplateInput,
} from "../services/communicationService";
import { useMutation } from "../hooks/useCommunications";
import styles from "../styles/communications.module.css";

/**
 * Gestão de templates reutilizáveis de comunicado.
 *
 * Templates inativos continuam visíveis (esmaecidos) para permitir reativação.
 */
export function CommunicationTemplatesPage() {
  const [editing, setEditing] = useState<CommunicationTemplateSummary>();
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string>();
  const [feedback, setFeedback] = useState<string>();

  const templates = useAsync(() => communicationService.templates(), []);
  const categories = useAsync(() => communicationService.categories(), []);

  const save = useMutation(
    async (input: TemplateInput) => {
      if (editing) return communicationService.updateTemplate(editing.id, input);
      return communicationService.createTemplate(input);
    },
    () => {
      setEditing(undefined);
      setCreating(false);
      setFeedback("Template salvo.");
      templates.reload();
    },
  );

  const toggle = useMutation(
    async (template: CommunicationTemplateSummary) => {
      setBusyId(template.id);
      return communicationService.updateTemplate(template.id, { active: !template.active });
    },
    () => {
      setBusyId(undefined);
      templates.reload();
    },
  );

  const remove = useMutation(
    async (template: CommunicationTemplateSummary) => {
      setBusyId(template.id);
      return communicationService.removeTemplate(template.id);
    },
    () => {
      setBusyId(undefined);
      setFeedback("Template excluído.");
      templates.reload();
    },
  );

  const error = templates.error ?? categories.error ?? save.error ?? toggle.error ?? remove.error;

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>COMUNICAÇÕES</span>
          <h1>Templates</h1>
          <p>
            Modelos reutilizáveis para agilizar comunicados recorrentes como abertura
            de turno, falha de energia e retomada de transmissão.
          </p>
        </div>
        <div className={styles.headerActions}>
          <Button
            onClick={() => {
              setEditing(undefined);
              setCreating((current) => !current);
            }}
          >
            {creating ? "Fechar formulário" : "Novo template"}
          </Button>
        </div>
      </header>

      {error && <ErrorState error={error} />}
      {feedback && <p className={styles.successText}>{feedback}</p>}

      {(creating || editing) && categories.data && (
        <Card>
          <h2>{editing ? `Editar ${editing.name}` : "Novo template"}</h2>
          <TemplateForm
            key={editing?.id ?? "new"}
            initial={editing ? templateToInput(editing) : undefined}
            categories={categories.data}
            saving={save.pending}
            onSubmit={(input) => void save.run(input)}
            onCancel={() => {
              setEditing(undefined);
              setCreating(false);
            }}
          />
        </Card>
      )}

      {templates.loading && <Loading label="Carregando templates…" />}
      {!templates.loading && templates.data?.length === 0 && (
        <EmptyState
          title="Nenhum template cadastrado"
          description="Cadastre um modelo para reutilizar título, corpo e prioridade padrão."
        />
      )}

      {templates.data && templates.data.length > 0 && (
        <TemplateList
          templates={templates.data}
          busyId={busyId}
          onEdit={(template) => {
            setCreating(false);
            setEditing(template);
          }}
          onToggle={(template) => void toggle.run(template)}
          onRemove={(template) => void remove.run(template)}
        />
      )}
    </section>
  );
}
