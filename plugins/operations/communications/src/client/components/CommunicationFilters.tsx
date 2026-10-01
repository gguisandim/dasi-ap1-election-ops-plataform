import { Button, Field, Input, Select } from "@eops/ui";
import {
  COMMUNICATION_PRIORITIES,
  COMMUNICATION_PRIORITY_LABELS,
  COMMUNICATION_STATUSES,
  COMMUNICATION_STATUS_LABELS,
  type CommunicationCategorySummary,
  type CommunicationTagSummary,
} from "@eops/shared/communications";
import type { CommunicationFilters as Filters } from "../services/communicationService";
import styles from "../styles/communications.module.css";

export interface CommunicationFiltersProps {
  value: Filters;
  categories: CommunicationCategorySummary[];
  tags: Array<CommunicationTagSummary & { usageCount?: number }>;
  elections: Array<{ id: string; name: string }>;
  onChange: (value: Filters) => void;
  onReset: () => void;
}

export function CommunicationFilters({
  value,
  categories,
  tags,
  elections,
  onChange,
  onReset,
}: CommunicationFiltersProps) {
  const set = <K extends keyof Filters>(key: K, next: Filters[K]) =>
    onChange({ ...value, [key]: next, page: 1 });

  return (
    <div className={styles.filters}>
      <Field label="Busca">
        <Input
          placeholder="Código, título, conteúdo ou autor"
          value={value.search ?? ""}
          onChange={(event) => set("search", event.target.value || undefined)}
        />
      </Field>
      <Field label="Status">
        <Select
          value={value.status ?? ""}
          onChange={(event) =>
            set("status", (event.target.value || undefined) as Filters["status"])
          }
        >
          <option value="">Todos</option>
          {COMMUNICATION_STATUSES.map((status) => (
            <option key={status} value={status}>
              {COMMUNICATION_STATUS_LABELS[status]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Prioridade">
        <Select
          value={value.priority ?? ""}
          onChange={(event) =>
            set("priority", (event.target.value || undefined) as Filters["priority"])
          }
        >
          <option value="">Todas</option>
          {COMMUNICATION_PRIORITIES.map((priority) => (
            <option key={priority} value={priority}>
              {COMMUNICATION_PRIORITY_LABELS[priority]}
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
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Pleito">
        <Select
          value={value.electionId ?? ""}
          onChange={(event) => set("electionId", event.target.value || undefined)}
        >
          <option value="">Todos</option>
          {elections.map((election) => (
            <option key={election.id} value={election.id}>
              {election.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Etiqueta">
        <Select value={value.tag ?? ""} onChange={(event) => set("tag", event.target.value || undefined)}>
          <option value="">Todas</option>
          {tags.map((tag) => (
            <option key={tag.id} value={tag.slug}>
              {tag.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Criado de">
        <Input
          type="date"
          value={value.from?.slice(0, 10) ?? ""}
          onChange={(event) => set("from", event.target.value || undefined)}
        />
      </Field>
      <Field label="Criado até">
        <Input
          type="date"
          value={value.to?.slice(0, 10) ?? ""}
          onChange={(event) => set("to", event.target.value || undefined)}
        />
      </Field>
      <div className={styles.filterActions}>
        <label className={styles.checkbox}>
          <input
            type="checkbox"
            checked={Boolean(value.urgentOnly)}
            onChange={(event) => set("urgentOnly", event.target.checked || undefined)}
          />
          Somente prioritários
        </label>
        <Button type="button" onClick={onReset}>
          Limpar filtros
        </Button>
      </div>
    </div>
  );
}
