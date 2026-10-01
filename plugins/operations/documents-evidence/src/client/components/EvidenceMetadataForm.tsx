import { useState, type FormEvent } from "react";
import { Button, ErrorState, Field, Input, Select } from "@eops/ui";
import {
  EVIDENCE_TYPES,
  EVIDENCE_TYPE_LABELS,
  type EvidenceSummary,
  type EvidenceType,
} from "@eops/shared/evidence";
import { EvidenceLinkEditor } from "./EvidenceLinkEditor";
import { TagInput } from "./TagInput";
import type { EvidenceReferenceData } from "../services/evidenceService";
import styles from "../styles/evidence.module.css";

export interface EvidenceMetadataValue {
  title: string;
  description?: string;
  type: EvidenceType;
  electionId?: string;
  origin?: string;
  observations?: string;
  capturedAt?: string;
  tags: string[];
  /** Vínculos no formato `TIPO:identificador`. */
  linkTokens: string[];
}

export function metadataValueOf(evidence: EvidenceSummary): EvidenceMetadataValue {
  return {
    title: evidence.title,
    description: evidence.description ?? undefined,
    type: evidence.type,
    electionId: evidence.electionId ?? undefined,
    origin: evidence.origin ?? undefined,
    observations: evidence.observations ?? undefined,
    capturedAt: evidence.capturedAt ? evidence.capturedAt.slice(0, 16) : undefined,
    tags: evidence.tags.map((tag) => tag.label),
    linkTokens: evidence.links.map((link) => `${link.type}:${link.targetId}`),
  };
}

/**
 * Edição de metadados e vínculos.
 *
 * Metadados e vínculos são salvos em chamadas separadas porque têm regras
 * distintas: metadados usam `PATCH`, e vínculos são substituídos por inteiro.
 */
export function EvidenceMetadataForm({
  initial,
  references,
  saving,
  error,
  onSubmit,
  onCancel,
}: {
  initial: EvidenceMetadataValue;
  references: EvidenceReferenceData;
  saving: boolean;
  error?: Error;
  onSubmit: (value: EvidenceMetadataValue) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState(initial);
  const set = <K extends keyof EvidenceMetadataValue>(
    key: K,
    next: EvidenceMetadataValue[K],
  ) => setForm((current) => ({ ...current, [key]: next }));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit(form);
  };

  return (
    <form className={styles.form} onSubmit={submit}>
      {error && <ErrorState error={error} />}

      <div className={styles.formGrid}>
        <Field label="Tipo de evidência">
          <Select
            value={form.type}
            onChange={(event) => set("type", event.target.value as EvidenceType)}
          >
            {EVIDENCE_TYPES.map((type) => (
              <option key={type} value={type}>
                {EVIDENCE_TYPE_LABELS[type]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Pleito">
          <Select
            value={form.electionId ?? ""}
            onChange={(event) => set("electionId", event.target.value || undefined)}
          >
            <option value="">Sem pleito associado</option>
            {references.elections.map((election) => (
              <option key={election.id} value={election.id}>
                {election.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Data do fato">
          <Input
            type="datetime-local"
            value={form.capturedAt ?? ""}
            onChange={(event) => set("capturedAt", event.target.value || undefined)}
          />
        </Field>
        <Field label="Origem">
          <Input
            maxLength={160}
            value={form.origin ?? ""}
            onChange={(event) => set("origin", event.target.value)}
          />
        </Field>
      </div>

      <Field label="Título">
        <Input
          required
          minLength={3}
          maxLength={180}
          value={form.title}
          onChange={(event) => set("title", event.target.value)}
        />
      </Field>

      <Field label="Descrição">
        <textarea
          className={styles.textarea}
          maxLength={4000}
          value={form.description ?? ""}
          onChange={(event) => set("description", event.target.value)}
        />
      </Field>

      <Field label="Etiquetas">
        <TagInput
          value={form.tags}
          suggestions={references.tags}
          onChange={(tags) => set("tags", tags)}
        />
      </Field>

      <Field label="Observações internas">
        <textarea
          className={styles.textareaSmall}
          maxLength={2000}
          value={form.observations ?? ""}
          onChange={(event) => set("observations", event.target.value)}
        />
      </Field>

      <EvidenceLinkEditor
        value={form.linkTokens}
        onChange={(tokens) => set("linkTokens", tokens)}
      />

      <div className={styles.actions}>
        <Button disabled={saving} type="submit">
          {saving ? "Salvando…" : "Salvar alterações"}
        </Button>
        <Button type="button" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
