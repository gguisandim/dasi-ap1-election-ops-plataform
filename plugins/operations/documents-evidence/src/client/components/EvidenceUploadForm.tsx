import { useRef, useState, type FormEvent } from "react";
import { Button, ErrorState, Field, Input, Select } from "@eops/ui";
import {
  EVIDENCE_TYPES,
  EVIDENCE_TYPE_LABELS,
  type EvidenceType,
} from "@eops/shared/evidence";
import type { EvidenceReferenceData, EvidenceUploadInput } from "../services/evidenceService";
import { EvidenceLinkEditor } from "./EvidenceLinkEditor";
import { TagInput } from "./TagInput";
import styles from "../styles/evidence.module.css";
import { formatBytes } from "../utils/format";
import { guessTypeFromFileName, typeLabel } from "../utils/presentation";
import { isImageEvidenceType } from "../utils/type-guards";

const EMPTY: EvidenceUploadInput = {
  title: "",
  description: "",
  type: "PHOTO",
  electionId: undefined,
  origin: "",
  observations: "",
  capturedAt: undefined,
  tags: [],
  linkTokens: [],
};

/**
 * Formulário de registro de evidência.
 *
 * O tipo é sugerido pela extensão do arquivo, mas sempre editável: só o usuário
 * sabe se aquela imagem é uma foto de campo ou uma captura de tela. A validação
 * de compatibilidade entre tipo e MIME é do backend e é antecipada aqui.
 */
export function EvidenceUploadForm({
  references,
  pending,
  progress,
  error,
  onSubmit,
}: {
  references: EvidenceReferenceData;
  pending: boolean;
  progress: number;
  error?: Error;
  onSubmit: (input: EvidenceUploadInput, file: File) => void;
}) {
  const [form, setForm] = useState<EvidenceUploadInput>(EMPTY);
  const [file, setFile] = useState<File>();
  const [localError, setLocalError] = useState<string>();
  const inputRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof EvidenceUploadInput>(key: K, next: EvidenceUploadInput[K]) =>
    setForm((current) => ({ ...current, [key]: next }));

  const selectFile = (selected: File | undefined) => {
    setFile(selected);
    setLocalError(undefined);
    if (!selected) return;
    if (!form.title) set("title", selected.name.replace(/\.[^.]+$/, ""));
    if (!form.origin) set("origin", "Envio manual pela plataforma");
    set("type", guessTypeFromFileName(selected.name));
  };

  const rules = references.typeRules[form.type];
  const imageOnly = isImageEvidenceType(form.type);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!file) {
      setLocalError("Selecione o arquivo que comprova a evidência.");
      return;
    }
    if (rules && file.size > rules.maxSizeBytes) {
      setLocalError(
        `O arquivo tem ${formatBytes(file.size)} e excede o limite de ${formatBytes(rules.maxSizeBytes)} para ${typeLabel(form.type)}.`,
      );
      return;
    }
    if (imageOnly && file.type && !file.type.startsWith("image/")) {
      setLocalError(`${typeLabel(form.type)} aceita apenas arquivos de imagem.`);
      return;
    }
    onSubmit(form, file);
  };

  return (
    <form className={styles.form} onSubmit={submit}>
      {error && <ErrorState error={error} />}
      {localError && <p className={styles.dangerText}>{localError}</p>}

      <div className={styles.dropzone}>
        <input
          ref={inputRef}
          type="file"
          className={styles.hiddenInput}
          onChange={(event) => selectFile(event.target.files?.[0])}
        />
        <strong>{file ? file.name : "Selecione o arquivo da evidência"}</strong>
        <small>
          {file
            ? `${formatBytes(file.size)} · ${file.type || "tipo não informado"}`
            : "O arquivo é gravado fora do banco, em armazenamento dedicado."}
        </small>
        <Button type="button" onClick={() => inputRef.current?.click()}>
          {file ? "Trocar arquivo" : "Escolher arquivo"}
        </Button>
      </div>

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
        <Field label="Pleito (opcional)">
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
        <Field label="Data do fato (opcional)">
          <Input
            type="datetime-local"
            value={form.capturedAt?.slice(0, 16) ?? ""}
            onChange={(event) => set("capturedAt", event.target.value || undefined)}
          />
        </Field>
        <Field label="Origem">
          <Input
            maxLength={160}
            placeholder="Ex.: vistoria presencial, envio da equipe Alfa"
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

      {pending && (
        <div className={styles.progress} role="status">
          <span style={{ width: `${progress}%` }} />
          <small>Enviando arquivo…</small>
        </div>
      )}

      <div className={styles.actions}>
        <Button disabled={pending} type="submit">
          {pending ? "Enviando…" : "Registrar evidência"}
        </Button>
        <small className={styles.mutedText}>
          Armazenamento: <b>{references.storageDriver}</b> · limite absoluto{" "}
          {formatBytes(references.maxUploadBytes)}
          {rules ? ` · limite do tipo ${formatBytes(rules.maxSizeBytes)}` : ""}
        </small>
      </div>
    </form>
  );
}
