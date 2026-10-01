import { Button } from "@eops/ui";
import { formatDateTime } from "@eops/shared/format";
import type { CommunicationTemplateSummary } from "@eops/shared/communications";
import { PriorityBadge } from "./CommunicationBadges";
import styles from "../styles/communications.module.css";

export function TemplateList({
  templates,
  busyId,
  onEdit,
  onToggle,
  onRemove,
}: {
  templates: CommunicationTemplateSummary[];
  busyId?: string;
  onEdit: (template: CommunicationTemplateSummary) => void;
  onToggle: (template: CommunicationTemplateSummary) => void;
  onRemove: (template: CommunicationTemplateSummary) => void;
}) {
  return (
    <div className={styles.templateGrid}>
      {templates.map((template) => (
        <article
          key={template.id}
          className={`${styles.templateCard} ${template.active ? "" : styles.inactiveCard}`}
        >
          <header>
            <strong>{template.name}</strong>
            <PriorityBadge priority={template.priority} />
          </header>
          <p>{template.description ?? "Sem descrição."}</p>
          <p className={styles.templateBody}>{template.body}</p>
          <footer>
            <span>{template.category?.name ?? "Sem categoria"}</span>
            <span>Atualizado em {formatDateTime(template.updatedAt)}</span>
          </footer>
          <div className={styles.rowActions}>
            <Button disabled={busyId === template.id} onClick={() => onEdit(template)}>
              Editar
            </Button>
            <Button
              disabled={busyId === template.id}
              onClick={() => onToggle(template)}
            >
              {template.active ? "Inativar" : "Ativar"}
            </Button>
            <Button disabled={busyId === template.id} onClick={() => onRemove(template)}>
              Excluir
            </Button>
          </div>
        </article>
      ))}
    </div>
  );
}
