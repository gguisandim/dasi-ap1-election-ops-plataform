import { Button } from "@eops/ui";
import {
  POSTMORTEM_CAUSE_CATEGORY_LABELS,
  POSTMORTEM_CAUSE_TYPE_LABELS,
  type PostmortemCauseType,
} from "@eops/shared/postmortems";
import type { PostmortemCause as CauseRecord } from "../../types";
import styles from "../styles/postmortems.module.css";

const typeClass: Record<PostmortemCauseType, string> = {
  ROOT_CAUSE: styles.causeRoot,
  CONTRIBUTING_FACTOR: styles.causeContributing,
  CONDITION: styles.causeCondition,
};

interface TreeNode {
  cause: CauseRecord;
  children: TreeNode[];
}

/** Monta a árvore a partir da lista plana, preservando o que a API retornou. */
export function buildCauseTree(causes: readonly CauseRecord[]): TreeNode[] {
  const nodes = new Map<string, TreeNode>(
    causes.map((cause) => [cause.id, { cause, children: [] }]),
  );
  const roots: TreeNode[] = [];
  for (const node of nodes.values()) {
    const parentId = node.cause.parentId;
    const parent = parentId ? nodes.get(parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

export function CauseTree({
  causes,
  canEdit,
  onAddChild,
  onEdit,
  onRemove,
}: {
  causes: CauseRecord[];
  canEdit: boolean;
  onAddChild: (parentId: string, type: PostmortemCauseType) => void;
  onEdit: (cause: CauseRecord) => void;
  onRemove: (cause: CauseRecord) => void;
}) {
  const roots = buildCauseTree(causes);
  if (roots.length === 0)
    return (
      <p className={styles.muted}>
        Nenhuma causa registrada. Comece pela causa raiz e desdobre fatores
        contribuintes e condições.
      </p>
    );

  const render = (node: TreeNode) => (
    <li key={node.cause.id}>
      <article className={`${styles.causeNode} ${typeClass[node.cause.type]}`}>
        <div className={styles.causeHeader}>
          <h4>{POSTMORTEM_CAUSE_TYPE_LABELS[node.cause.type]}</h4>
          <span className={styles.muted}>
            {POSTMORTEM_CAUSE_CATEGORY_LABELS[node.cause.category]}
          </span>
        </div>
        <p>{node.cause.statement}</p>
        {node.cause.evidence && (
          <p className={styles.causeEvidence}>Evidência: {node.cause.evidence}</p>
        )}
        {canEdit && (
          <div className={styles.causeActions}>
            <Button
              secondary
              onClick={() => onAddChild(node.cause.id, "CONTRIBUTING_FACTOR")}
            >
              Adicionar desdobramento
            </Button>
            <Button secondary onClick={() => onEdit(node.cause)}>
              Editar
            </Button>
            <Button secondary onClick={() => onRemove(node.cause)}>
              Remover
            </Button>
          </div>
        )}
        {node.children.length > 0 && (
          <ul className={styles.causeChildren}>
            {node.children.map((child) => render(child))}
          </ul>
        )}
      </article>
    </li>
  );

  return <ol className={styles.causeTree}>{roots.map((node) => render(node))}</ol>;
}
