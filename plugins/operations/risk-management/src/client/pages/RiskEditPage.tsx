import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ErrorState, LinkButton, Loading } from "@eops/ui";
import { RiskForm, type RiskFormValue } from "../components/RiskForm";
import { RiskLevelBadge, RiskStatusBadge } from "../components/RiskBadges";
import { MitigationEditor } from "../components/MitigationList";
import { riskService } from "../services/riskService";
import { useRisk, useRiskReferenceData } from "../hooks/useRisks";
import type { RiskMitigationInput } from "@eops/shared/risks";
import styles from "../styles/risk.module.css";

/**
 * Edição de risco.
 *
 * A avaliação (probabilidade, impacto, situação) vai por `PATCH`; o plano de
 * mitigação é substituído em bloco. Cada alteração entra no histórico.
 */
export function RiskEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const risk = useRisk(id);
  const references = useRiskReferenceData();
  const [form, setForm] = useState<RiskFormValue>();
  const [mitigations, setMitigations] = useState<RiskMitigationInput[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<Error>();

  useEffect(() => {
    const data = risk.data;
    if (!data) return;
    setForm({
      title: data.title,
      description: data.description,
      electionId: data.electionId,
      electoralZoneId: data.electoralZoneId ?? undefined,
      pollingPlaceId: data.pollingPlaceId ?? undefined,
      categoryId: data.categoryId,
      ownerName: data.ownerName,
      responsibleName: data.responsibleName,
      probability: data.probability,
      impact: data.impact,
      status: data.status,
      identifiedAt: data.identifiedAt.slice(0, 10),
      dueDate: data.dueDate ? data.dueDate.slice(0, 10) : undefined,
      observations: data.observations ?? "",
    });
    setMitigations(
      (data.mitigations ?? []).map((mitigation) => ({
        description: mitigation.description,
        responsibleName: mitigation.responsibleName,
        dueDate: mitigation.dueDate ? mitigation.dueDate.slice(0, 10) : undefined,
        status: mitigation.status,
        progress: mitigation.progress,
        evidenceId: mitigation.evidenceId ?? undefined,
        evidenceLabel: mitigation.evidenceLabel ?? undefined,
        notes: mitigation.notes ?? undefined,
      })),
    );
  }, [risk.data]);

  if (risk.loading || references.loading) return <Loading label="Carregando risco…" />;
  if (risk.error || references.error) {
    return <ErrorState error={risk.error ?? references.error} onRetry={risk.reload} />;
  }
  const data = risk.data;
  if (!data || !id || !references.data || !form) {
    return <ErrorState error={new Error("Risco não encontrado.")} />;
  }
  if (data.status === "CLOSED") {
    return (
      <ErrorState
        error={new Error(
          "Riscos encerrados são preservados para consulta e não aceitam alteração.",
        )}
      />
    );
  }

  const submit = async () => {
    setSaving(true);
    setError(undefined);
    try {
      await riskService.update(id, {
        title: form.title,
        description: form.description,
        electoralZoneId: form.electoralZoneId,
        pollingPlaceId: form.pollingPlaceId,
        categoryId: form.categoryId,
        ownerName: form.ownerName,
        responsibleName: form.responsibleName,
        probability: form.probability,
        impact: form.impact,
        status: form.status,
        dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : undefined,
        observations: form.observations,
      });
      await riskService.replaceMitigations(
        id,
        mitigations.map((mitigation) => ({
          ...mitigation,
          dueDate: mitigation.dueDate
            ? new Date(mitigation.dueDate).toISOString()
            : undefined,
        })),
      );
      navigate(`/risks/${id}`);
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
          <span className={styles.eyebrow}>RISCO {data.code}</span>
          <h1>Editar risco</h1>
          <div className={styles.badges}>
            <RiskLevelBadge level={data.level} score={data.score} />
            <RiskStatusBadge status={data.status} />
          </div>
        </div>
        <div className={styles.headerActions}>
          <LinkButton to={`/risks/${data.id}`} secondary>
            Ver risco
          </LinkButton>
        </div>
      </header>

      {error && <ErrorState error={error} />}

      <RiskForm
        value={form}
        references={references.data}
        saving={saving}
        error={error}
        editing
        submitLabel="Salvar avaliação"
        onChange={setForm}
        onSubmit={() => void submit()}
        onCancel={() => navigate(`/risks/${id}`)}
      />

      <MitigationEditor
        value={mitigations}
        saving={saving}
        onChange={setMitigations}
        onSubmit={() => void submit()}
      />
    </section>
  );
}
