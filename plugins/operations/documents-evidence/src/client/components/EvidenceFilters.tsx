import { Button, Field, Input, Select } from "@eops/ui";
import {
  EVIDENCE_LINK_LABELS,
  EVIDENCE_LINK_TYPES,
  EVIDENCE_STATUSES,
  EVIDENCE_STATUS_LABELS,
  EVIDENCE_TYPES,
  EVIDENCE_TYPE_LABELS,
  type EvidenceTagSummary,
} from "@eops/shared/evidence";
import type { EvidenceFilters as Filters, EvidenceReferenceData } from "../services/evidenceService";
import styles from "../styles/evidence.module.css";

export function EvidenceFilters({
  value,
  references,
  onChange,
  onReset,
}: {
  value: Filters;
  references?: EvidenceReferenceData;
  onChange: (value: Filters) => void;
  onReset: () => void;
}) {
  const set = <K extends keyof Filters>(key: K, next: Filters[K]) =>
    onChange({ ...value, [key]: next, page: 1 });

  return (
    <div className={styles.filters}>
      <Field label="Busca">
        <Input
          placeholder="Código, título, descrição, origem ou autor"
          value={value.search ?? ""}
          onChange={(event) => set("search", event.target.value || undefined)}
        />
      </Field>
      <Field label="Tipo">
        <Select
          value={value.type ?? ""}
          onChange={(event) => set("type", (event.target.value || undefined) as Filters["type"])}
        >
          <option value="">Todos</option>
          {EVIDENCE_TYPES.map((type) => (
            <option key={type} value={type}>
              {EVIDENCE_TYPE_LABELS[type]}
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
          {EVIDENCE_STATUSES.map((status) => (
            <option key={status} value={status}>
              {EVIDENCE_STATUS_LABELS[status]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Registro vinculado">
        <Select
          value={value.linkType ?? ""}
          onChange={(event) =>
            set("linkType", (event.target.value || undefined) as Filters["linkType"])
          }
        >
          <option value="">Qualquer</option>
          {EVIDENCE_LINK_TYPES.map((type) => (
            <option key={type} value={type}>
              {EVIDENCE_LINK_LABELS[type]}
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
          {(references?.elections ?? []).map((election) => (
            <option key={election.id} value={election.id}>
              {election.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Etiqueta">
        <Select value={value.tag ?? ""} onChange={(event) => set("tag", event.target.value || undefined)}>
          <option value="">Todas</option>
          {(references?.tags ?? []).map((tag: EvidenceTagSummary) => (
            <option key={tag.id} value={tag.slug}>
              {tag.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Registrado de">
        <Input
          type="date"
          value={value.from?.slice(0, 10) ?? ""}
          onChange={(event) => set("from", event.target.value || undefined)}
        />
      </Field>
      <Field label="Registrado até">
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
            checked={Boolean(value.withoutLinks)}
            onChange={(event) => set("withoutLinks", event.target.checked || undefined)}
          />
          Somente sem vínculo
        </label>
        <Button type="button" onClick={onReset}>
          Limpar filtros
        </Button>
      </div>
    </div>
  );
}
