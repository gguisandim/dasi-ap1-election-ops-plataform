import { isImageEvidenceType } from "../utils/type-guards";
import { useEvidenceBlobUrl } from "../hooks/useEvidence";
import type { EvidenceType } from "@eops/shared/evidence";
import styles from "../styles/evidence.module.css";
import { extensionLabel } from "../utils/format";
import { TYPE_ICONS, typeLabel } from "../utils/presentation";

/**
 * Miniatura da versão corrente.
 *
 * Somente tipos de imagem são buscados como blob: para os demais, o custo de
 * baixar o arquivo inteiro não se justifica e exibimos um marcador pelo tipo.
 */
export function EvidenceThumbnail({
  evidenceId,
  type,
  extension,
  size = 96,
}: {
  evidenceId: string;
  type: EvidenceType;
  extension?: string;
  size?: number;
}) {
  const isImage = isImageEvidenceType(type);
  const { url, loading, error } = useEvidenceBlobUrl(isImage ? evidenceId : undefined);

  if (!isImage) {
    return (
      <div className={styles.thumbPlaceholder} style={{ width: size, height: size }}>
        <span aria-hidden="true">{TYPE_ICONS[type]}</span>
        <small>{extensionLabel(extension ?? "")}</small>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${styles.thumbPlaceholder} ${styles.thumbError}`} style={{ width: size, height: size }}>
        <small>indisponível</small>
      </div>
    );
  }

  if (loading || !url) {
    return (
      <div className={styles.thumbPlaceholder} style={{ width: size, height: size }}>
        <small>carregando…</small>
      </div>
    );
  }

  return (
    <img
      className={styles.thumb}
      style={{ width: size, height: size }}
      src={url}
      alt={`Evidência ${typeLabel(type)}`}
      loading="lazy"
    />
  );
}
