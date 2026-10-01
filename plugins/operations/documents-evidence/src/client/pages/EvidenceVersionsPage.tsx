import { useState } from "react";
import { useParams } from "react-router-dom";
import { Card, ErrorState, LinkButton, Loading, useAsync } from "@eops/ui";
import type { EvidenceVersionSummary } from "@eops/shared/evidence";
import {
  EvidenceVersionForm,
  EvidenceVersionList,
} from "../components/EvidenceVersionList";
import { evidenceService } from "../services/evidenceService";
import { useEvidence } from "../hooks/useEvidence";
import styles from "../styles/evidence.module.css";
import { describeInterval, formatBytes, formatChecksum } from "../utils/format";

/**
 * Histórico de versões de uma evidência.
 *
 * Nenhuma versão é removida: a lista inteira permanece baixável, e a comparação
 * entre versões destaca o que mudou de uma para a outra.
 */
export function EvidenceVersionsPage() {
  const { id } = useParams<{ id: string }>();
  const evidence = useEvidence(id);
  const versions = useAsync(
    () => (id ? evidenceService.versions(id) : Promise.resolve([])),
    [id ?? ""],
  );
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState<string>();
  const [error, setError] = useState<Error>();
  const [feedback, setFeedback] = useState<string>();

  if (evidence.loading || versions.loading) return <Loading label="Carregando versões…" />;
  if (evidence.error || versions.error) {
    return (
      <ErrorState error={evidence.error ?? versions.error} onRetry={versions.reload} />
    );
  }
  const data = evidence.data;
  if (!data || !id) return <ErrorState error={new Error("Evidência não encontrada.")} />;

  const list = versions.data ?? [];
  const current = list.find((version) => version.isCurrent);
  const previous = list.find((version) => version.number === (current?.number ?? 0) - 1);

  const download = async (version: EvidenceVersionSummary) => {
    setDownloading(version.id);
    setError(undefined);
    try {
      const blob = await evidenceService.fileBlob(id, version.id);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = version.fileName;
      anchor.click();
      URL.revokeObjectURL(url);
      setFeedback(`Versão ${version.number} baixada.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason : new Error("Falha ao baixar a versão."));
    } finally {
      setDownloading(undefined);
    }
  };

  const addVersion = async (file: File, reason: string, description?: string) => {
    setSaving(true);
    setError(undefined);
    try {
      await evidenceService.addVersion(id, file, reason, description);
      setFeedback("Nova versão registrada. A anterior foi preservada.");
      versions.reload();
      evidence.reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason : new Error("Não foi possível versionar."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>EVIDÊNCIA {data.code}</span>
          <h1>Versões do arquivo</h1>
          <p>
            {list.length} versão(ões) registrada(s). Substituir o arquivo nunca apaga a
            anterior — cada versão mantém autor, motivo e checksum próprios.
          </p>
        </div>
        <div className={styles.headerActions}>
          <LinkButton to={`/evidence/${data.id}`} secondary>
            Ver ficha
          </LinkButton>
        </div>
      </header>

      {error && <ErrorState error={error} />}
      {feedback && <p className={styles.successText}>{feedback}</p>}

      {current && previous && (
        <Card>
          <h2>Comparação com a versão anterior</h2>
          <div className={styles.diffGrid}>
            <div>
              <span>v{previous.number}</span>
              <strong>{formatBytes(previous.size)}</strong>
              <code className={styles.checksum}>{formatChecksum(previous.checksum)}</code>
            </div>
            <div>
              <span>v{current.number}</span>
              <strong>{formatBytes(current.size)}</strong>
              <code className={styles.checksum}>{formatChecksum(current.checksum)}</code>
            </div>
            <div>
              <span>Intervalo</span>
              <strong>{describeInterval(previous.createdAt, current.createdAt)}</strong>
              <small>
                {current.size === previous.size
                  ? "mesmo tamanho; conteúdo " +
                    (current.checksum === previous.checksum ? "idêntico" : "diferente")
                  : `${current.size > previous.size ? "+" : "−"}${formatBytes(Math.abs(current.size - previous.size))}`}
              </small>
            </div>
          </div>
          {current.checksum === previous.checksum && (
            <p className={styles.warningText}>
              O checksum é igual ao da versão anterior: o arquivo reenviado tem o mesmo
              conteúdo.
            </p>
          )}
        </Card>
      )}

      <Card>
        <h2>Adicionar versão</h2>
        <EvidenceVersionForm saving={saving} error={error} onSubmit={(file, reason, description) => void addVersion(file, reason, description)} />
      </Card>

      <Card>
        <h2>Histórico</h2>
        <EvidenceVersionList
          versions={list}
          downloading={downloading}
          onDownload={(version) => void download(version)}
        />
      </Card>
    </section>
  );
}
