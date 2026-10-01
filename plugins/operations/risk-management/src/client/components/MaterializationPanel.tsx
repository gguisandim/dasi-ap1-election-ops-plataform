import { useState, type FormEvent } from "react";
import { Button, Field, Input, Select } from "@eops/ui";
import type { MaterializeInput } from "../services/riskService";
import styles from "../styles/risk.module.css";

/**
 * Registro de materialização do risco.
 *
 * Só aparece enquanto o risco não foi materializado nem encerrado. O incidente é
 * associado por ID: o vínculo é uma referência, não uma dependência de plugin.
 */
export function MaterializationPanel({
  saving,
  incidents,
  onSubmit,
}: {
  saving: boolean;
  incidents: Array<{ id: string; code: string; title: string }>;
  onSubmit: (input: MaterializeInput) => void;
}) {
  const [actualImpact, setActualImpact] = useState("");
  const [notes, setNotes] = useState("");
  const [incidentId, setIncidentId] = useState("");
  const [error, setError] = useState<string>();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (actualImpact.trim().length < 3) {
      setError("Descreva o impacto real observado.");
      return;
    }
    setError(undefined);
    onSubmit({
      actualImpact: actualImpact.trim(),
      notes: notes.trim() || undefined,
      incidentId: incidentId || undefined,
    });
  };

  return (
    <form className={styles.form} onSubmit={submit}>
      <h2>Registrar materialização</h2>
      <p className={styles.mutedText}>
        A materialização encerra a hipótese: o risco aconteceu. Registre o impacto real e,
        se houver, o incidente correspondente.
      </p>
      <Field label="Incidente associado (opcional)">
        <Select value={incidentId} onChange={(event) => setIncidentId(event.target.value)}>
          <option value="">Sem incidente associado</option>
          {incidents.map((incident) => (
            <option key={incident.id} value={incident.id}>
              {incident.code} · {incident.title}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Impacto real observado">
        <textarea
          required
          className={styles.textareaSmall}
          value={actualImpact}
          onChange={(event) => setActualImpact(event.target.value)}
        />
      </Field>
      <Field label="Observações">
        <Input value={notes} onChange={(event) => setNotes(event.target.value)} />
      </Field>
      {error && <p className={styles.dangerText}>{error}</p>}
      <div className={styles.actions}>
        <Button disabled={saving} type="submit">
          {saving ? "Registrando…" : "Registrar materialização"}
        </Button>
      </div>
    </form>
  );
}
