import { useState, type FormEvent } from "react";
import { Button, Field, Input, Select } from "@eops/ui";
import {
  COMMUNICATION_PRIORITIES,
  COMMUNICATION_PRIORITY_LABELS,
  type CommunicationCategorySummary,
  type CommunicationPriority,
  type CommunicationTemplateSummary,
} from "@eops/shared/communications";
import type { TemplateInput } from "../services/communicationService";
import styles from "../styles/communications.module.css";

const EMPTY: TemplateInput = {
  name: "",
  description: "",
  defaultTitle: "",
  body: "",
  priority: "NORMAL",
  categoryId: undefined,
};

export function templateToInput(template: CommunicationTemplateSummary): TemplateInput {
  return {
    name: template.name,
    description: template.description ?? "",
    defaultTitle: template.defaultTitle,
    body: template.body,
    priority: template.priority,
    categoryId: template.categoryId ?? undefined,
    active: template.active,
  };
}

/**
 * Formulário de template reutilizável.
 *
 * O corpo é texto puro; a interface preserva quebras de linha ao aplicar.
 */
export function TemplateForm({
  initial,
  categories,
  saving,
  onSubmit,
  onCancel,
}: {
  initial?: TemplateInput;
  categories: CommunicationCategorySummary[];
  saving: boolean;
  onSubmit: (input: TemplateInput) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<TemplateInput>(initial ?? EMPTY);
  const set = <K extends keyof TemplateInput>(key: K, next: TemplateInput[K]) =>
    setForm((current) => ({ ...current, [key]: next }));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit({
      ...form,
      description: form.description || undefined,
      categoryId: form.categoryId || undefined,
    });
  };

  return (
    <form className={styles.form} onSubmit={submit}>
      <div className={styles.formGrid}>
        <Field label="Nome">
          <Input
            required
            minLength={3}
            maxLength={120}
            value={form.name}
            onChange={(event) => set("name", event.target.value)}
          />
        </Field>
        <Field label="Categoria">
          <Select
            value={form.categoryId ?? ""}
            onChange={(event) => set("categoryId", event.target.value || undefined)}
          >
            <option value="">Sem categoria</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Prioridade padrão">
          <Select
            value={form.priority ?? "NORMAL"}
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
        <Field label="Descrição">
          <Input
            maxLength={500}
            value={form.description ?? ""}
            onChange={(event) => set("description", event.target.value)}
          />
        </Field>
      </div>
      <Field label="Título padrão">
        <Input
          required
          minLength={3}
          maxLength={180}
          value={form.defaultTitle}
          onChange={(event) => set("defaultTitle", event.target.value)}
        />
      </Field>
      <Field label="Corpo do comunicado">
        <textarea
          required
          className={styles.textarea}
          minLength={3}
          maxLength={8000}
          value={form.body}
          onChange={(event) => set("body", event.target.value)}
        />
      </Field>
      <div className={styles.actions}>
        <Button disabled={saving} type="submit">
          {saving ? "Salvando…" : "Salvar template"}
        </Button>
        <Button type="button" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
