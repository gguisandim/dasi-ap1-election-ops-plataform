import { useNavigate, useSearchParams } from "react-router-dom";
import { ErrorState, Loading } from "@eops/ui";
import { EvidenceUploadForm } from "../components/EvidenceUploadForm";
import { useEvidenceReferenceData, useEvidenceUpload } from "../hooks/useEvidence";
import type { EvidenceLinkType } from "@eops/shared/evidence";
import { parseLinkToken } from "../components/EvidenceLinkEditor";
import styles from "../styles/evidence.module.css";

/**
 * Registro de nova evidência.
 *
 * Aceita `?link=TIPO:id` para permitir que outras telas (detalhe de incidente,
 * local, entrega) enviem o vínculo já preenchido, sem duplicar formulários.
 */
export function EvidenceUploadPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const references = useEvidenceReferenceData();
  const upload = useEvidenceUpload();

  const presetToken = searchParams.get("link");
  const preset = presetToken ? parseLinkToken(presetToken) : null;

  if (references.loading) return <Loading label="Carregando formulário…" />;
  if (references.error || !references.data) {
    return (
      <ErrorState
        error={references.error ?? new Error("Dados de apoio indisponíveis.")}
        onRetry={references.reload}
      />
    );
  }

  const referenceData = references.data;
  const rules = referenceData.typeRules;

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>EVIDÊNCIAS</span>
          <h1>Nova evidência</h1>
          <p>
            O arquivo é gravado fora do banco e recebe checksum SHA-256 no momento do
            envio, permitindo detectar qualquer alteração posterior.
          </p>
          {preset && (
            <p className={styles.mutedText}>
              Vínculo sugerido pela tela de origem:{" "}
              <b>{preset.type as EvidenceLinkType}</b> · {preset.targetId}
            </p>
          )}
        </div>
      </header>

      <EvidenceUploadForm
        references={referenceData}
        pending={upload.pending}
        progress={upload.progress}
        error={upload.error}
        onSubmit={(input, file) => {
          const tokens = preset
            ? [...new Set([...input.linkTokens, `${preset.type}:${preset.targetId}`])]
            : input.linkTokens;
          const effectiveType = input.type;
          const typeRules = rules[effectiveType];
          void upload
            .upload(
              { ...input, linkTokens: tokens },
              file,
              typeRules?.maxSizeBytes ?? referenceData.maxUploadBytes,
              typeRules?.imageOnly ?? false,
            )
            .then((created) => {
              if (created) navigate(`/evidence/${created.id}`);
            });
        }}
      />
    </section>
  );
}
