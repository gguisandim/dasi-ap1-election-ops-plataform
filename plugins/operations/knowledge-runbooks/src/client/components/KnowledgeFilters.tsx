import { Button, Field, Input, Select } from "@eops/ui";
import {
  KNOWLEDGE_KINDS,
  KNOWLEDGE_KIND_LABELS,
  KNOWLEDGE_STATUSES,
  KNOWLEDGE_STATUS_LABELS,
  type KnowledgeTagSummary,
} from "@eops/shared/knowledge";
import type { KnowledgeFilters as Filters } from "../services/knowledgeService";
import type { KnowledgeReferenceData } from "../services/knowledgeService";
import styles from "../styles/knowledge.module.css";

export function KnowledgeFilters({
  value,
  references,
  onChange,
  onReset,
}: {
  value: Filters;
  references?: KnowledgeReferenceData;
  onChange: (value: Filters) => void;
  onReset: () => void;
}) {
  const set = <K extends keyof Filters>(key: K, next: Filters[K]) =>
    onChange({ ...value, [key]: next, page: 1 });

  const incidentCategoryName = (key: string) =>
    references?.incidentCategories.find((category) => category.key === key)?.name ?? key;

  return (
    <div className={styles.filters}>
      <Field label="Busca">
        <Input
          placeholder="Título, resumo, problema, sintomas ou conteúdo"
          value={value.search ?? ""}
          onChange={(event) => set("search", event.target.value || undefined)}
        />
      </Field>
      <Field label="Tipo">
        <Select
          value={value.kind ?? ""}
          onChange={(event) => set("kind", (event.target.value || undefined) as Filters["kind"])}
        >
          <option value="">Artigos e runbooks</option>
          {KNOWLEDGE_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {KNOWLEDGE_KIND_LABELS[kind]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Situação">
        <Select
          value={value.status ?? ""}
          onChange={(event) =>
            set("status", (event.target.value || undefined) as Filters["status"])
          }
        >
          <option value="">Todas</option>
          {KNOWLEDGE_STATUSES.map((status) => (
            <option key={status} value={status}>
              {KNOWLEDGE_STATUS_LABELS[status]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Categoria">
        <Select
          value={value.categoryId ?? ""}
          onChange={(event) => set("categoryId", event.target.value || undefined)}
        >
          <option value="">Todas</option>
          {(references?.categories ?? []).map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Categoria de incidente">
        <Select
          value={value.incidentCategoryKey ?? ""}
          onChange={(event) => set("incidentCategoryKey", event.target.value || undefined)}
        >
          <option value="">Qualquer</option>
          {(references?.incidentCategories ?? []).map((category) => (
            <option key={category.key} value={category.key}>
              {incidentCategoryName(category.key)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Etiqueta">
        <Select value={value.tag ?? ""} onChange={(event) => set("tag", event.target.value || undefined)}>
          <option value="">Todas</option>
          {(references?.tags ?? []).map((tag: KnowledgeTagSummary & { slug: string }) => (
            <option key={tag.id} value={tag.slug}>
              {tag.label}
            </option>
          ))}
        </Select>
      </Field>
      <div className={styles.filterActions}>
        <label className={styles.checkbox}>
          <input
            type="checkbox"
            checked={Boolean(value.staleOnly)}
            onChange={(event) => set("staleOnly", event.target.checked || undefined)}
          />
          Desatualizados
        </label>
        <label className={styles.checkbox}>
          <input
            type="checkbox"
            checked={Boolean(value.unusedOnly)}
            onChange={(event) => set("unusedOnly", event.target.checked || undefined)}
          />
          Sem uso
        </label>
        <Button type="button" onClick={onReset}>
          Limpar filtros
        </Button>
      </div>
    </div>
  );
}
