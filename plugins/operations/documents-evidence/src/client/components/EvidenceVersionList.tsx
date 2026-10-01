import { useState, type FormEvent } from "react";
import { Button, Field, Input } from "@eops/ui";
import { formatDateTime } from "@eops/shared/format";
import type { EvidenceVersionSummary } from "@eops/shared/evidence";
import styles from "../styles/evidence.module.css";
import { extensionLabel, formatBytes, formatChecksum } from "../utils/format";

/**
 * Histórico de versões.
 *
 * A versão corrente é destacada; as anteriores continuam listadas e baixáveis.
 * O motivo da alteração aparece em cada linha — é ele que explica por que o
 * arquivo mudou.
 */
export function EvidenceVersionList({
  versions,
  onDownload,
  downloading,
}: {
  versions: EvidenceVersionSummary[];
  onDownload: (version: EvidenceVersionSummary) => void;
  downloading?: string;
}) {
  if (versions.length === 0) {
    return <p className={styles.mutedText}>Nenhuma versão registrada.</p>;
  }
  return (
    <div className={styles.tableWrap}>
      <table>
        <thead>
          <tr>
            <th>Versão</th>
            <th>Arquivo</th>
            <th>Tamanho</th>
            <th>Autor</th>
            <th>Motivo da alteração</th>
            <th>Registrada em</th>
            <th>SHA-256</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {versions.map((version) => (
            <tr key={version.id} className={version.isCurrent ? styles.currentRow : undefined}>
              <td>
                <strong>v{version.number}</strong>
                {version.isCurrent && <small className={styles.successText}>atual</small>}
              </td>
              <td>
                {version.fileName}
                <small>
                  {extensionLabel(version.extension)} · {version.mimeType}
                </small>
              </td>
              <td>{formatBytes(version.size)}</td>
              <td>{version.authorName}</td>
              <td>
                {version.reason ?? <span className={styles.mutedText}>versão inicial</span>}
                {version.description && <small>{version.description}</small>}
              </td>
              <td>{formatDateTime(version.createdAt)}</td>
              <td>
                <code className={styles.checksum}>{formatChecksum(version.checksum)}</code>
              </td>
              <td>
                <Button disabled={downloading === version.id} onClick={() => onDownload(version)}>
                  Baixar
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Envio de nova versão; o motivo é obrigatório por decisão de domínio. */
export function EvidenceVersionForm({
  saving,
  error,
  onSubmit,
}: {
  saving: boolean;
  error?: Error;
  onSubmit: (file: File, reason: string, description?: string) => void;
}) {
  const [file, setFile] = useState<File>();
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [localError, setLocalError] = useState<string>();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!file) {
      setLocalError("Selecione o arquivo da nova versão.");
      return;
    }
    if (reason.trim().length < 3) {
      setLocalError("Descreva o motivo da alteração — a substituição não pode ser silenciosa.");
      return;
    }
    setLocalError(undefined);
    onSubmit(file, reason.trim(), description.trim() || undefined);
  };

  return (
    <form className={styles.form} onSubmit={submit}>
      {error && <p className={styles.dangerText}>{error.message}</p>}
      {localError && <p className={styles.dangerText}>{localError}</p>}

      <div className={styles.formGrid}>
        <Field label="Arquivo da nova versão">
          <Input
            type="file"
            onChange={(event) => setFile(event.target.files?.[0])}
          />
        </Field>
        <Field label="Motivo da alteração">
          <Input
            required
            minLength={3}
            maxLength={500}
            placeholder="Ex.: imagem recortada para destacar a etiqueta da urna"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </Field>
        <Field label="Descrição (opcional)">
          <Input
            maxLength={1000}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </Field>
      </div>

      <div className={styles.actions}>
        <Button disabled={saving} type="submit">
          {saving ? "Enviando…" : "Adicionar versão"}
        </Button>
        <small className={styles.mutedText}>
          A versão anterior é preservada e continua disponível para download.
        </small>
      </div>
    </form>
  );
}
