import { useState, type FormEvent } from "react";
import { Button, ErrorState, Field, Input, Select } from "@eops/ui";
import {
  KNOWLEDGE_KINDS,
  KNOWLEDGE_KIND_LABELS,
  type KnowledgeArticleInput,
  type KnowledgeArticleKind,
  type RunbookStepInput,
} from "@eops/shared/knowledge";
import type { KnowledgeReferenceData } from "../services/knowledgeService";
import { RunbookStepsEditor } from "./RunbookStepsEditor";
import { TagInput } from "./TagInput";
import styles from "../styles/knowledge.module.css";
import { keywordsFromText } from "../utils/presentation";

export interface KnowledgeFormValue extends KnowledgeArticleInput {
  steps: RunbookStepInput[];
}

export const emptyKnowledgeForm = (kind: KnowledgeArticleKind = "ARTICLE"): KnowledgeFormValue => ({
  kind,
  title: "",
  summary: "",
  content: "",
  categoryId: undefined,
  tags: [],
  incidentCategoryKey: undefined,
  incidentSeverity: undefined,
  assetTypeKey: undefined,
  keywords: [],
  problem: "",
  symptoms: "",
  diagnosis: "",
  prerequisites: "",
  validation: "",
  rollback: "",
  escalation: "",
  references: "",
  changeNote: undefined,
  steps: kind === "RUNBOOK" ? [{ order: 1, title: "", instruction: "", required: true }] : [],
});

const SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

/**
 * Formulário de artigo ou runbook.
 *
 * O tipo define os campos visíveis: runbooks acrescentam problema, sintomas,
 * diagnóstico, validação, rollback, escalonamento, referências e passos
 * ordenados. A associação (categoria de incidente, severidade, tipo de ativo e
 * palavras-chave) é o que alimenta a recomendação automática.
 */
export function KnowledgeArticleForm({
  value,
  references,
  saving,
  error,
  editing,
  submitLabel,
  onChange,
  onSubmit,
  onCancel,
}: {
  value: KnowledgeFormValue;
  references: KnowledgeReferenceData;
  saving: boolean;
  error?: Error;
  editing: boolean;
  submitLabel: string;
  onChange: (value: KnowledgeFormValue) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  const [keywordDraft, setKeywordDraft] = useState("");
  const set = <K extends keyof KnowledgeFormValue>(key: K, next: KnowledgeFormValue[K]) =>
    onChange({ ...value, [key]: next });

  const isRunbook = value.kind === "RUNBOOK";

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit();
  };

  const addKeywords = (raw: string) => {
    const parsed = keywordsFromText(raw);
    const merged = [...new Set([...value.keywords, ...parsed])].slice(0, 20);
    set("keywords", merged);
    setKeywordDraft("");
  };

  return (
    <form className={styles.form} onSubmit={submit}>
      {error && <ErrorState error={error} />}

      <div className={styles.formGrid}>
        <Field label="Tipo de verbete">
          <Select
            value={value.kind}
            disabled={editing}
            onChange={(event) => {
              const kind = event.target.value as KnowledgeArticleKind;
              onChange({
                ...emptyKnowledgeForm(kind),
                title: value.title,
                summary: value.summary,
                content: value.content,
                categoryId: value.categoryId,
                tags: value.tags,
                incidentCategoryKey: value.incidentCategoryKey,
                incidentSeverity: value.incidentSeverity,
                assetTypeKey: value.assetTypeKey,
                keywords: value.keywords,
                steps: value.steps.length ? value.steps : emptyKnowledgeForm(kind).steps,
              });
            }}
          >
            {KNOWLEDGE_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {KNOWLEDGE_KIND_LABELS[kind]}
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
        <Field label="Categoria de incidente associada">
          <Select
            value={value.incidentCategoryKey ?? ""}
            onChange={(event) =>
              set("incidentCategoryKey", event.target.value || undefined)
            }
          >
            <option value="">Nenhuma</option>
            {references.incidentCategories.map((category) => (
              <option key={category.key} value={category.key}>
                {category.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Severidade alvo">
          <Select
            value={value.incidentSeverity ?? ""}
            onChange={(event) => set("incidentSeverity", event.target.value || undefined)}
          >
            <option value="">Qualquer</option>
            {SEVERITIES.map((severity) => (
              <option key={severity} value={severity}>
                {severity}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Tipo de ativo associado">
          <Select
            value={value.assetTypeKey ?? ""}
            onChange={(event) => set("assetTypeKey", event.target.value || undefined)}
          >
            <option value="">Nenhum</option>
            {references.assetTypes.map((type) => (
              <option key={type.key} value={type.key}>
                {type.name}
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

      <Field label="Resumo">
        <Input
          required
          minLength={3}
          maxLength={1000}
          placeholder="Uma frase que permita decidir se este verbete é o certo"
          value={value.summary}
          onChange={(event) => set("summary", event.target.value)}
        />
      </Field>

      <Field label="Etiquetas">
        <TagInput
          value={value.tags}
          suggestions={references.tags}
          onChange={(tags) => set("tags", tags)}
        />
      </Field>

      {isRunbook ? (
        <>
          <div className={styles.formGrid}>
            <Field label="Problema que resolve">
              <textarea
                required
                className={styles.textareaSmall}
                value={value.problem ?? ""}
                onChange={(event) => set("problem", event.target.value)}
              />
            </Field>
            <Field label="Sintomas observáveis">
              <textarea
                className={styles.textareaSmall}
                value={value.symptoms ?? ""}
                onChange={(event) => set("symptoms", event.target.value)}
              />
            </Field>
            <Field label="Diagnóstico">
              <textarea
                className={styles.textareaSmall}
                value={value.diagnosis ?? ""}
                onChange={(event) => set("diagnosis", event.target.value)}
              />
            </Field>
            <Field label="Pré-requisitos">
              <textarea
                className={styles.textareaSmall}
                value={value.prerequisites ?? ""}
                onChange={(event) => set("prerequisites", event.target.value)}
              />
            </Field>
            <Field label="Validação após execução">
              <textarea
                className={styles.textareaSmall}
                value={value.validation ?? ""}
                onChange={(event) => set("validation", event.target.value)}
              />
            </Field>
            <Field label="Rollback">
              <textarea
                className={styles.textareaSmall}
                value={value.rollback ?? ""}
                onChange={(event) => set("rollback", event.target.value)}
              />
            </Field>
            <Field label="Escalonamento">
              <textarea
                className={styles.textareaSmall}
                value={value.escalation ?? ""}
                onChange={(event) => set("escalation", event.target.value)}
              />
            </Field>
            <Field label="Referências">
              <textarea
                className={styles.textareaSmall}
                value={value.references ?? ""}
                onChange={(event) => set("references", event.target.value)}
              />
            </Field>
          </div>
        </>
      ) : (
        <Field label="Conteúdo">
          <textarea
            className={styles.textarea}
            maxLength={20000}
            value={value.content ?? ""}
            onChange={(event) => set("content", event.target.value)}
          />
        </Field>
      )}

      {isRunbook && (
        <Field label="Conteúdo complementar (opcional)">
          <textarea
            className={styles.textareaSmall}
            value={value.content ?? ""}
            onChange={(event) => set("content", event.target.value)}
          />
        </Field>
      )}

      <div className={styles.keywordBlock}>
        <Field label="Palavras-chave para recomendação">
          <Input
            placeholder="Digite uma palavra e pressione Enter"
            value={keywordDraft}
            onChange={(event) => setKeywordDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addKeywords(keywordDraft);
              }
            }}
          />
        </Field>
        <div className={styles.tagList}>
          {value.keywords.map((keyword) => (
            <span key={keyword} className={styles.tag}>
              {keyword}
              <button
                type="button"
                aria-label={`Remover ${keyword}`}
                onClick={() =>
                  set(
                    "keywords",
                    value.keywords.filter((item) => item !== keyword),
                  )
                }
              >
                ×
              </button>
            </span>
          ))}
          {value.keywords.length === 0 && (
            <small className={styles.mutedText}>
              Sem palavras-chave, o runbook só é recomendado por categoria, severidade ou
              tipo de ativo.
            </small>
          )}
        </div>
      </div>

      {isRunbook && <RunbookStepsEditor value={value.steps} onChange={(steps) => set("steps", steps)} />}

      {editing && (
        <Field label="Nota da alteração">
          <Input
            maxLength={500}
            placeholder="Obrigatória quando o verbete já saiu do rascunho"
            value={value.changeNote ?? ""}
            onChange={(event) => set("changeNote", event.target.value || undefined)}
          />
        </Field>
      )}

      <div className={styles.actions}>
        <Button disabled={saving} type="submit">
          {saving ? "Salvando…" : submitLabel}
        </Button>
        <Button type="button" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
