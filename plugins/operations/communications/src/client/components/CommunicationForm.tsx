import { useState, type FormEvent } from "react";
import { Button, ErrorState, Field, Input, Select } from "@eops/ui";
import {
  COMMUNICATION_PRIORITIES,
  COMMUNICATION_PRIORITY_LABELS,
  type CommunicationAudienceInput,
  type CommunicationFormInput,
  type CommunicationPriority,
  type CommunicationTemplateSummary,
} from "@eops/shared/communications";
import type { ReferenceData } from "../services/communicationService";
import { AudienceEditor } from "./AudienceEditor";
import { TagInput } from "./TagInput";
import styles from "../styles/communications.module.css";

export type CommunicationFormValue = CommunicationFormInput;

export interface CommunicationFormProps {
  value: CommunicationFormValue;
  references: ReferenceData;
  saving: boolean;
  error?: Error;
  submitLabel: string;
  onChange: (value: CommunicationFormValue) => void;
  onSubmit: (publish: boolean) => void;
  onCancel: () => void;
}

/**
 * Formulário de comunicado.
 *
 * Concentra composição (título, corpo, prioridade, categoria, tags), validade e
 * direcionamento. Aplicar um template sobrescreve título, corpo, prioridade e
 * categoria — decisão explícita para não mesclar texto de origens diferentes.
 */
export function CommunicationForm({
  value,
  references,
  saving,
  error,
  submitLabel,
  onChange,
  onSubmit,
  onCancel,
}: CommunicationFormProps) {
  const [appliedTemplate, setAppliedTemplate] = useState("");

  const set = <K extends keyof CommunicationFormValue>(
    key: K,
    next: CommunicationFormValue[K],
  ) => onChange({ ...value, [key]: next });

  const applyTemplate = (templateId: string) => {
    setAppliedTemplate(templateId);
    const template: CommunicationTemplateSummary | undefined = references.templates.find(
      (item) => item.id === templateId,
    );
    if (!template) return;
    onChange({
      ...value,
      title: template.defaultTitle,
      content: template.body,
      priority: template.priority,
      categoryId: template.categoryId ?? undefined,
    });
  };

  const canPublish = value.audiences.length > 0 && !saving;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit(false);
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      {error && <ErrorState error={error} />}

      <div className={styles.formGrid}>
        <Field label="Pleito">
          <Select
            required
            value={value.electionId}
            onChange={(event) => set("electionId", event.target.value)}
          >
            <option value="">Selecione</option>
            {references.elections.map((election) => (
              <option key={election.id} value={election.id}>
                {election.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Categoria">
          <Select
            value={value.categoryId ?? ""}
            onChange={(event) => set("categoryId", event.target.value || undefined)}
          >
            <option value="">Sem categoria</option>
            {references.categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Prioridade">
          <Select
            value={value.priority}
            onChange={(event) =>
              set("priority", event.target.value as CommunicationPriority)
            }
          >
            {COMMUNICATION_PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {COMMUNICATION_PRIORITY_LABELS[priority]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Validade (opcional)">
          <Input
            type="datetime-local"
            value={value.expiresAt?.slice(0, 16) ?? ""}
            onChange={(event) => set("expiresAt", event.target.value || undefined)}
          />
        </Field>
        <Field label="Aplicar template">
          <Select
            value={appliedTemplate}
            onChange={(event) => applyTemplate(event.target.value)}
          >
            <option value="">Nenhum</option>
            {references.templates
              .filter((template) => template.active)
              .map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
          </Select>
        </Field>
      </div>

      <Field label="Título">
        <Input
          required
          minLength={3}
          maxLength={180}
          value={value.title}
          onChange={(event) => set("title", event.target.value)}
        />
      </Field>

      <Field label="Conteúdo">
        <textarea
          required
          className={styles.textarea}
          minLength={3}
          maxLength={8000}
          value={value.content}
          onChange={(event) => set("content", event.target.value)}
        />
      </Field>

      <Field label="Etiquetas">
        <TagInput
          value={value.tags}
          suggestions={references.tags}
          onChange={(tags) => set("tags", tags)}
        />
      </Field>

      <Field label="Observações internas">
        <textarea
          className={styles.textareaSmall}
          maxLength={2000}
          value={value.observations ?? ""}
          onChange={(event) => set("observations", event.target.value || undefined)}
        />
      </Field>

      <AudienceEditor
        value={value.audiences}
        references={references}
        onChange={(audiences: CommunicationAudienceInput[]) => set("audiences", audiences)}
      />

      <div className={styles.actions}>
        <Button disabled={saving} type="submit">
          {saving ? "Salvando…" : submitLabel}
        </Button>
        <Button
          disabled={!canPublish}
          type="button"
          onClick={() => onSubmit(true)}
        >
          {saving ? "Publicando…" : "Salvar e publicar"}
        </Button>
        <Button type="button" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
