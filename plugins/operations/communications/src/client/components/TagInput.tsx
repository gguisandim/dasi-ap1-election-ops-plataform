import { useState, type KeyboardEvent } from "react";
import { Button, Input } from "@eops/ui";
import type { CommunicationTagSummary } from "@eops/shared/communications";
import styles from "../styles/communications.module.css";

/**
 * Editor simples de etiquetas: digitar e pressionar Enter adiciona.
 * Sugere etiquetas já usadas em outros comunicados.
 */
export function TagInput({
  value,
  suggestions,
  onChange,
}: {
  value: string[];
  suggestions: CommunicationTagSummary[];
  onChange: (tags: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  const add = (label: string) => {
    const trimmed = label.trim();
    if (!trimmed) return;
    const exists = value.some((tag) => tag.toLowerCase() === trimmed.toLowerCase());
    if (!exists) onChange([...value, trimmed]);
    setDraft("");
  };

  const remove = (label: string) =>
    onChange(value.filter((tag) => tag !== label));

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      add(draft);
    }
    if (event.key === "Backspace" && !draft && value.length > 0) {
      remove(value[value.length - 1]);
    }
  };

  const unused = suggestions.filter(
    (tag) => !value.some((current) => current.toLowerCase() === tag.label.toLowerCase()),
  );

  return (
    <div className={styles.tagInput}>
      <div className={styles.tagList}>
        {value.map((tag) => (
          <span key={tag} className={styles.tag}>
            {tag}
            <button type="button" aria-label={`Remover ${tag}`} onClick={() => remove(tag)}>
              ×
            </button>
          </span>
        ))}
      </div>
      <div className={styles.tagEntry}>
        <Input
          placeholder="Digite e pressione Enter"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
        />
        <Button type="button" onClick={() => add(draft)}>
          Adicionar
        </Button>
      </div>
      {unused.length > 0 && (
        <div className={styles.tagSuggestions}>
          {unused.slice(0, 8).map((tag) => (
            <button key={tag.id} type="button" onClick={() => add(tag.label)}>
              + {tag.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
