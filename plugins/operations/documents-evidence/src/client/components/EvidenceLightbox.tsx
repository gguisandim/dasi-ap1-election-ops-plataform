import { useEffect } from "react";
import { Link } from "react-router-dom";
import { formatDateTime } from "@eops/shared/format";
import type { EvidenceSummary } from "@eops/shared/evidence";
import { useEvidenceBlobUrl } from "../hooks/useEvidence";
import styles from "../styles/evidence.module.css";
import { formatBytes, formatChecksum } from "../utils/format";

/**
 * Modal de ampliação de uma evidência.
 *
 * Mostra o arquivo e, ao lado, os metadados que dão contexto à imagem: procedência,
 * autor, data do fato e checksum. Sem isso uma foto ampliada continua sendo apenas
 * uma foto.
 */
export function EvidenceLightbox({
  evidence,
  onClose,
  onPrevious,
  onNext,
}: {
  evidence: EvidenceSummary;
  onClose: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
}) {
  const { url, loading, error } = useEvidenceBlobUrl(evidence.id);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") onPrevious?.();
      if (event.key === "ArrowRight") onNext?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onPrevious, onNext]);

  return (
    <div className={styles.lightboxBackdrop} role="dialog" aria-modal="true" onClick={onClose}>
      <div className={styles.lightbox} onClick={(event) => event.stopPropagation()}>
        <header>
          <div>
            <span className={styles.code}>{evidence.code}</span>
            <strong>{evidence.title}</strong>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </header>

        <div className={styles.lightboxBody}>
          <div className={styles.lightboxStage}>
            {loading && <p className={styles.mutedText}>Carregando arquivo…</p>}
            {error && <p className={styles.dangerText}>Arquivo indisponível no armazenamento.</p>}
            {url && <img src={url} alt={evidence.title} />}
          </div>

          <aside className={styles.lightboxMeta}>
            <h3>Metadados</h3>
            <dl>
              <dt>Arquivo</dt>
              <dd>{evidence.version?.fileName ?? "—"}</dd>
              <dt>Tipo</dt>
              <dd>{evidence.version?.mimeType ?? "—"}</dd>
              <dt>Tamanho</dt>
              <dd>{evidence.version ? formatBytes(evidence.version.size) : "—"}</dd>
              <dt>Versão</dt>
              <dd>v{evidence.version?.number ?? 0}</dd>
              <dt>Autor</dt>
              <dd>{evidence.authorName}</dd>
              <dt>Origem</dt>
              <dd>{evidence.origin ?? "—"}</dd>
              <dt>Data do fato</dt>
              <dd>
                {evidence.capturedAt ? formatDateTime(evidence.capturedAt) : "não informada"}
              </dd>
            </dl>
            {evidence.version && (
              <>
                <h3>Integridade</h3>
                <code className={styles.checksumBlock}>
                  {formatChecksum(evidence.version.checksum)}
                </code>
                <small className={styles.mutedText}>SHA-256 do conteúdo</small>
              </>
            )}
            {evidence.links.length > 0 && (
              <>
                <h3>Vínculos</h3>
                <ul className={styles.lightboxLinks}>
                  {evidence.links.map((link) => (
                    <li key={link.id}>{link.targetLabel ?? link.targetId}</li>
                  ))}
                </ul>
              </>
            )}
            <Link className={styles.inlineLink} to={`/evidence/${evidence.id}`}>
              Abrir ficha completa
            </Link>
          </aside>
        </div>

        {(onPrevious || onNext) && (
          <footer className={styles.lightboxNav}>
            <button type="button" onClick={onPrevious} disabled={!onPrevious}>
              ← Anterior
            </button>
            <button type="button" onClick={onNext} disabled={!onNext}>
              Próxima →
            </button>
          </footer>
        )}
      </div>
    </div>
  );
}
