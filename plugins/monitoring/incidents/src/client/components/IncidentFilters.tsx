import { Input, Select } from "@eops/ui";
import { INCIDENT_SEVERITIES, INCIDENT_SEVERITY_LABELS, INCIDENT_STATUSES, INCIDENT_STATUS_LABELS, type IncidentCategorySummary } from "@eops/shared";
import type { IncidentFilters as Filters } from "../services/incidentService";
import styles from "../styles/incidents.module.css";

export function IncidentFilters({ value, categories, onChange }: { value: Filters; categories: IncidentCategorySummary[]; onChange: (value: Filters) => void }) {
  const update = (key: keyof Filters, fieldValue: string) => onChange({ ...value, [key]: fieldValue || undefined, page: 1 });
  return (
    <div className={styles.filters}>
      <Input aria-label="Pesquisar incidentes" placeholder="Código, título ou descrição" value={value.search ?? ""} onChange={(event) => update("search", event.target.value)} />
      <Select aria-label="Filtrar por status" value={value.status ?? ""} onChange={(event) => update("status", event.target.value)}>
        <option value="">Todos os status</option>
        {INCIDENT_STATUSES.map((status) => <option key={status} value={status}>{INCIDENT_STATUS_LABELS[status]}</option>)}
      </Select>
      <Select aria-label="Filtrar por severidade" value={value.severity ?? ""} onChange={(event) => update("severity", event.target.value)}>
        <option value="">Todas as severidades</option>
        {INCIDENT_SEVERITIES.map((severity) => <option key={severity} value={severity}>{INCIDENT_SEVERITY_LABELS[severity]}</option>)}
      </Select>
      <Select aria-label="Filtrar por categoria" value={value.categoryId ?? ""} onChange={(event) => update("categoryId", event.target.value)}>
        <option value="">Todas as categorias</option>
        {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
      </Select>
      <Input aria-label="Responsável" placeholder="ID do responsável" value={value.assignedToId ?? ""} onChange={(event) => update("assignedToId", event.target.value)} />
      <Input aria-label="Período inicial" type="date" value={value.from ?? ""} onChange={(event) => update("from", event.target.value)} />
      <Input aria-label="Período final" type="date" value={value.to ?? ""} onChange={(event) => update("to", event.target.value)} />
    </div>
  );
}
