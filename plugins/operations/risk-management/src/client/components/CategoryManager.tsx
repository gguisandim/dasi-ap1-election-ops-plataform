import { useState, type FormEvent } from "react";
import { Button, Field, Input } from "@eops/ui";
import type { RiskCategorySummary } from "@eops/shared/risks";
import styles from "../styles/risk.module.css";

type CategoryRow = RiskCategorySummary & { _count?: { risks: number } };

/** Categorias de risco, cadastráveis pela operação. */
export function CategoryManager({
  categories,
  saving,
  onCreate,
  onToggle,
  onRename,
}: {
  categories: CategoryRow[];
  saving: boolean;
  onCreate: (input: { key: string; name: string; description?: string }) => void;
  onToggle: (category: RiskCategorySummary) => void;
  onRename: (category: RiskCategorySummary, name: string) => void;
}) {
  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [editing, setEditing] = useState<Record<string, string>>({});

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onCreate({ key: key.trim(), name: name.trim(), description: description.trim() || undefined });
    setKey("");
    setName("");
    setDescription("");
  };

  return (
    <div className={styles.categoryManager}>
      <form className={styles.form} onSubmit={submit}>
        <h2>Nova categoria</h2>
        <div className={styles.formGrid}>
          <Field label="Chave">
            <Input
              required
              minLength={2}
              maxLength={60}
              placeholder="POWER"
              value={key}
              onChange={(event) => setKey(event.target.value)}
            />
          </Field>
          <Field label="Nome">
            <Input
              required
              minLength={2}
              maxLength={120}
              placeholder="Energia"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
          <Field label="Descrição">
            <Input
              maxLength={500}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </Field>
        </div>
        <div className={styles.actions}>
          <Button disabled={saving} type="submit">
            Criar categoria
          </Button>
        </div>
      </form>

      <div className={styles.tableWrap}>
        <table>
          <thead>
            <tr>
              <th>Chave</th>
              <th>Nome</th>
              <th>Riscos</th>
              <th>Situação</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {categories.map((category) => (
              <tr key={category.id} className={category.active ? undefined : styles.inactiveRow}>
                <td>
                  <code>{category.key}</code>
                </td>
                <td>
                  <Input
                    aria-label={`Nome da categoria ${category.key}`}
                    value={editing[category.id] ?? category.name}
                    onChange={(event) =>
                      setEditing((current) => ({ ...current, [category.id]: event.target.value }))
                    }
                  />
                  {category.description && <small>{category.description}</small>}
                </td>
                <td>{category._count?.risks ?? 0}</td>
                <td>{category.active ? "Ativa" : "Inativa"}</td>
                <td className={styles.rowActions}>
                  <Button
                    disabled={saving || !editing[category.id]}
                    onClick={() => {
                      const next = editing[category.id];
                      if (next) onRename(category, next);
                      setEditing((current) => {
                        const copy = { ...current };
                        delete copy[category.id];
                        return copy;
                      });
                    }}
                  >
                    Salvar
                  </Button>
                  <Button disabled={saving} onClick={() => onToggle(category)}>
                    {category.active ? "Inativar" : "Ativar"}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
