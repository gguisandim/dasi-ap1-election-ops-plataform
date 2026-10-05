import { Badge, Button, LinkButton } from "@eops/ui";
import { OPERATIONAL_MAP_TYPE_LABELS, type OperationalMapFeature } from "../../shared/types/operational-map";
import { statusLabel, statusTone } from "../utils/labels";
import styles from "../styles/map.module.css";

export function MapSelectionPanel({ feature, onClose }: { feature: OperationalMapFeature; onClose: () => void }) {
  const entries = Object.entries(feature.metadata).filter(([, value]) => value !== null && value !== "");
  return (
    <aside className={styles.selection} aria-label="Detalhe da feature selecionada">
      <header>
        <small>{OPERATIONAL_MAP_TYPE_LABELS[feature.type]}</small>
        <Button secondary onClick={onClose} aria-label="Fechar detalhe">Fechar</Button>
      </header>
      <strong>{feature.title}</strong>
      {feature.subtitle && <span>{feature.subtitle}</span>}
      <div className={styles.selectionStatus}>
        <Badge tone={statusTone(feature.status)}>{statusLabel(feature.status)}</Badge>
        {feature.severity && <Badge tone="danger">Severidade {feature.severity}</Badge>}
      </div>
      {entries.length > 0 && (
        <dl>
          {entries.map(([key, value]) => (
            <div key={key}>
              <dt>{key}</dt>
              <dd>{String(value)}</dd>
            </div>
          ))}
        </dl>
      )}
      <p>Atualizado em {new Date(feature.updatedAt).toLocaleString("pt-BR")}</p>
      {feature.deepLink && <LinkButton to={feature.deepLink}>Abrir domínio</LinkButton>}
    </aside>
  );
}
