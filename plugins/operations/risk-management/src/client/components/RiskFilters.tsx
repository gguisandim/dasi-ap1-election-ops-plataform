import { Button, Field, Input, Select } from "@eops/ui";
import {
  RISK_LEVELS,
  RISK_LEVEL_LABELS,
  RISK_SCALE,
  RISK_SCALE_LABELS,
  RISK_STATUSES,
  RISK_STATUS_LABELS,
} from "@eops/shared/risks";
import type { RiskFilters as Filters, RiskReferenceData } from "../services/riskService";
import styles from "../styles/risk.module.css";

export function RiskFilters({
  value,
  references,
  onChange,
  onReset,
}: {
  value: Filters;
  references?: RiskReferenceData;
  onChange: (value: Filters) => void;
  onReset: () => void;
}) {
  const set = <K extends keyof Filters>(key: K, next: Filters[K]) =>
    onChange({ ...value, [key]: next, page: 1 });

  const places = (references?.places ?? []).filter(
    (place) => !value.electoralZoneId || place.electoralZoneId === value.electoralZoneId,
  );

  return (
    <div className={styles.filters}>
      <Field label="Busca">
        <Input
          placeholder="Código, título, descrição, proprietário ou responsável"
          value={value.search ?? ""}
          onChange={(event) => set("search", event.target.value || undefined)}
        />
      </Field>
      <Field label="Classificação">
        <Select
          value={value.level ?? ""}
          onChange={(event) => set("level", (event.target.value || undefined) as Filters["level"])}
        >
          <option value="">Todas</option>
          {RISK_LEVELS.map((level) => (
            <option key={level} value={level}>
              {RISK_LEVEL_LABELS[level]}
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
          {RISK_STATUSES.map((status) => (
            <option key={status} value={status}>
              {RISK_STATUS_LABELS[status]}
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
      <Field label="Zona">
        <Select
          value={value.electoralZoneId ?? ""}
          onChange={(event) =>
            set("electoralZoneId", event.target.value || undefined)
          }
        >
          <option value="">Todas</option>
          {(references?.zones ?? [])
            .filter((zone) => !value.electionId || zone.electionId === value.electionId)
            .map((zone) => (
              <option key={zone.id} value={zone.id}>
                Zona {zone.number} · {zone.name}
              </option>
            ))}
        </Select>
      </Field>
      <Field label="Local">
        <Select
          value={value.pollingPlaceId ?? ""}
          onChange={(event) => set("pollingPlaceId", event.target.value || undefined)}
        >
          <option value="">Todos</option>
          {places.map((place) => (
            <option key={place.id} value={place.id}>
              {place.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Probabilidade">
        <Select
          value={value.probability ?? ""}
          onChange={(event) =>
            set("probability", (event.target.value || undefined) as Filters["probability"])
          }
        >
          <option value="">Qualquer</option>
          {RISK_SCALE.map((value_) => (
            <option key={value_} value={value_}>
              {RISK_SCALE_LABELS[value_]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Impacto">
        <Select
          value={value.impact ?? ""}
          onChange={(event) =>
            set("impact", (event.target.value || undefined) as Filters["impact"])
          }
        >
          <option value="">Qualquer</option>
          {RISK_SCALE.map((value_) => (
            <option key={value_} value={value_}>
              {RISK_SCALE_LABELS[value_]}
            </option>
          ))}
        </Select>
      </Field>
      <div className={styles.filterActions}>
        <label className={styles.checkbox}>
          <input
            type="checkbox"
            checked={Boolean(value.withoutMitigation)}
            onChange={(event) => set("withoutMitigation", event.target.checked || undefined)}
          />
          Sem mitigação
        </label>
        <label className={styles.checkbox}>
          <input
            type="checkbox"
            checked={Boolean(value.withOverdueMitigation)}
            onChange={(event) => set("withOverdueMitigation", event.target.checked || undefined)}
          />
          Mitigação atrasada
        </label>
        <Button type="button" onClick={onReset}>
          Limpar filtros
        </Button>
      </div>
    </div>
  );
}
