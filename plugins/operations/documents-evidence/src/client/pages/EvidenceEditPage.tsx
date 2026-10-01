import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ErrorState, LinkButton, Loading } from "@eops/ui";
import {
  EvidenceMetadataForm,
  metadataValueOf,
  type EvidenceMetadataValue,
} from "../components/EvidenceMetadataForm";
import { EvidenceStatusBadge, EvidenceTypeBadge } from "../components/EvidenceBadges";
import { evidenceService } from "../services/evidenceService";
import { useEvidence, useEvidenceReferenceData } from "../hooks/useEvidence";
import { parseLinkToken } from "../components/EvidenceLinkEditor";
import type { EvidenceLinkInput } from "@eops/shared/evidence";
import styles from "../styles/evidence.module.css";

/**
 * Edição de metadados e vínculos.
 *
 * Metadados são enviados por `PATCH`; vínculos são substituídos por inteiro em
 * uma segunda chamada, porque as duas operações têm regras e permissões
 * diferentes no backend.
 */
export function EvidenceEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const evidence = useEvidence(id);
  const references = useEvidenceReferenceData();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<Error>();

  if (evidence.loading || references.loading) return <Loading label="Carregando evidência…" />;
  if (evidence.error || references.error) {
    return (
      <ErrorState
        error={evidence.error ?? references.error}
        onRetry={evidence.reload}
      />
    );
  }
  const data = evidence.data;
  if (!data || !id || !references.data) {
    return <ErrorState error={new Error("Evidência não encontrada.")} />;
  }

  const submit = async (value: EvidenceMetadataValue) => {
    setSaving(true);
    setError(undefined);
    try {
      await evidenceService.update(id, {
        title: value.title,
        description: value.description,
        type: value.type,
        electionId: value.electionId,
        origin: value.origin,
        observations: value.observations,
        capturedAt: value.capturedAt ? new Date(value.capturedAt).toISOString() : undefined,
        tags: value.tags,
      });

      const links = value.linkTokens
        .map(parseLinkToken)
        .filter((link): link is { type: NonNullable<ReturnType<typeof parseLinkToken>>["type"]; targetId: string } => link !== null)
        .map((link) => ({ type: link.type, targetId: link.targetId }) as EvidenceLinkInput);
      await evidenceService.replaceLinks(id, links);

      navigate(`/evidence/${id}`);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason : new Error("Não foi possível salvar as alterações."),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>EVIDÊNCIA {data.code}</span>
          <h1>Editar evidência</h1>
          <div className={styles.badges}>
            <EvidenceTypeBadge type={data.type} />
            <EvidenceStatusBadge status={data.status} />
          </div>
          <p className={styles.mutedText}>
            O arquivo não é alterado por esta tela. Para trocar o conteúdo, adicione uma
            nova versão com o motivo da alteração.
          </p>
        </div>
        <div className={styles.headerActions}>
          <LinkButton to={`/evidence/${data.id}/versions`} secondary>
            Versões
          </LinkButton>
          <LinkButton to={`/evidence/${data.id}`} secondary>
            Ver ficha
          </LinkButton>
        </div>
      </header>

      <EvidenceMetadataForm
        initial={metadataValueOf(data)}
        references={references.data}
        saving={saving}
        error={error}
        onSubmit={(value) => void submit(value)}
        onCancel={() => navigate(`/evidence/${id}`)}
      />
    </section>
  );
}
