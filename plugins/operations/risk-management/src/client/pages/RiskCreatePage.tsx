import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ErrorState, Loading } from "@eops/ui";
import { RiskForm, emptyRiskForm, type RiskFormValue } from "../components/RiskForm";
import { riskService } from "../services/riskService";
import { useRiskReferenceData } from "../hooks/useRisks";
import styles from "../styles/risk.module.css";

/** Registro de novo risco. O score é confirmado pelo servidor ao salvar. */
export function RiskCreatePage() {
  const navigate = useNavigate();
  const references = useRiskReferenceData();
  const [form, setForm] = useState<RiskFormValue>(emptyRiskForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<Error>();

  if (references.loading) return <Loading label="Carregando formulário…" />;
  if (references.error || !references.data) {
    return (
      <ErrorState
        error={references.error ?? new Error("Dados de apoio indisponíveis.")}
        onRetry={references.reload}
      />
    );
  }

  const submit = async () => {
    setSaving(true);
    setError(undefined);
    try {
      const created = await riskService.create({
        ...form,
        identifiedAt: form.identifiedAt
          ? new Date(form.identifiedAt).toISOString()
          : undefined,
        dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : undefined,
      });
      navigate(`/risks/${created.id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason : new Error("Não foi possível salvar o risco."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>RISCOS</span>
          <h1>Novo risco</h1>
          <p>
            Registre o risco com proprietário e responsável definidos. Sem dono, um risco
            não sai do papel.
          </p>
        </div>
      </header>
      <RiskForm
        value={form}
        references={references.data}
        saving={saving}
        error={error}
        editing={false}
        submitLabel="Registrar risco"
        onChange={setForm}
        onSubmit={() => void submit()}
        onCancel={() => navigate("/risks/list")}
      />
    </section>
  );
}
