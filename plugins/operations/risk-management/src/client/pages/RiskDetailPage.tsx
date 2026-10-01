import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button, Card, ErrorState, LinkButton, Loading, useAsync } from "@eops/ui";
import { formatDate, formatDateTime } from "@eops/shared/format";
import { RISK_SCALE_LABELS } from "@eops/shared/risks";
import { MitigationList } from "../components/MitigationList";
import { MaterializationPanel } from "../components/MaterializationPanel";
import { RiskChip, RiskLevelBadge, RiskStatusBadge } from "../components/RiskBadges";
import { RiskTimeline } from "../components/RiskTimeline";
import { riskService } from "../services/riskService";
import { useRisk } from "../hooks/useRisks";
import styles from "../styles/risk.module.css";
import { progressLabel, scoreBand } from "../utils/presentation";

/**
 * Detalhe do risco: avaliação, plano de mitigação, materialização e histórico.
 */
export function RiskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const risk = useRisk(id);
  const references = useAsync(() => riskService.referenceData(), []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<Error>();
  const [feedback, setFeedback] = useState<string>();

  if (risk.loading) return <Loading label="Carregando risco…" />;
  if (risk.error) return <ErrorState error={risk.error} onRetry={risk.reload} />;
  const data = risk.data;
  if (!data || !id) return <ErrorState error={new Error("Risco não encontrado.")} />;

  const act = async (operation: () => Promise<unknown>, message: string) => {
    setSaving(true);
    setError(undefined);
    setFeedback(undefined);
    try {
      await operation();
      setFeedback(message);
      risk.reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason : new Error("Operação não concluída."));
    } finally {
      setSaving(false);
    }
  };

  const canMaterialize = data.status !== "MATERIALIZED" && data.status !== "CLOSED";

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>RISCO {data.code}</span>
          <h1>{data.title}</h1>
          <div className={styles.badges}>
            <RiskLevelBadge level={data.level} score={data.score} />
            <RiskStatusBadge status={data.status} />
            <RiskChip label={data.category?.name ?? "Sem categoria"} />
            {data.mitigationCount === 0 && <RiskChip label="sem mitigação" icon="!" />}
            {data.hasOverdueMitigation && <RiskChip label="ação atrasada" icon="!" />}
            {data.overdue && <RiskChip label="prazo vencido" icon="!" />}
          </div>
        </div>
        <div className={styles.headerActions}>
          <LinkButton to={`/risks/${data.id}/edit`} secondary>
            Editar
          </LinkButton>
          <LinkButton to="/risks/list" secondary>
            Lista
          </LinkButton>
        </div>
      </header>

      {error && <ErrorState error={error} />}
      {feedback && <p className={styles.successText}>{feedback}</p>}

      <div className={styles.detailGrid}>
        <div className={styles.detailMain}>
          <Card>
            <h2>Descrição</h2>
            <p className={styles.content}>{data.description}</p>
            {data.observations && (
              <>
                <h3>Observações</h3>
                <p className={styles.mutedText}>{data.observations}</p>
              </>
            )}

            <h2>Avaliação</h2>
            <div className={styles.assessmentRow}>
              <div className={styles.assessmentPreview}>
                <span>Probabilidade</span>
                <strong>{RISK_SCALE_LABELS[data.probability]}</strong>
              </div>
              <div className={styles.assessmentPreview}>
                <span>Impacto</span>
                <strong>{RISK_SCALE_LABELS[data.impact]}</strong>
              </div>
              <div className={styles.assessmentPreview}>
                <span>Score</span>
                <strong>{data.score}</strong>
                <small>
                  faixa {scoreBand(data.score)} · {data.level}
                </small>
              </div>
            </div>

            {data.status === "MATERIALIZED" && (
              <>
                <h2>Materialização</h2>
                <dl className={styles.metaList}>
                  <dt>Registrada em</dt>
                  <dd>
                    {data.materializedAt ? formatDateTime(data.materializedAt) : "—"}
                  </dd>
                  <dt>Impacto real</dt>
                  <dd>{data.actualImpact ?? "—"}</dd>
                  <dt>Observações</dt>
                  <dd>{data.materializationNotes ?? "—"}</dd>
                  <dt>Incidente</dt>
                  <dd>{data.incidentId ?? "não vinculado"}</dd>
                </dl>
              </>
            )}
          </Card>

          <Card>
            <h2>Plano de mitigação</h2>
            <p className={styles.mutedText}>
              Progresso consolidado: {progressLabel(data.mitigationProgress)} de{" "}
              {data.mitigationCount} ação(ões).
            </p>
            <MitigationList mitigations={data.mitigations ?? []} />
          </Card>

          {canMaterialize && (
            <MaterializationPanel
              saving={saving}
              incidents={references.data?.incidents ?? []}
              onSubmit={(input) =>
                void act(
                  () => riskService.materialize(id, input),
                  "Materialização registrada. O risco saiu da condição de hipótese.",
                )
              }
            />
          )}
        </div>

        <div className={styles.detailSide}>
          <Card>
            <h2>Procedência</h2>
            <dl className={styles.metaList}>
              <dt>Pleito</dt>
              <dd>{data.election?.name ?? "—"}</dd>
              <dt>Zona</dt>
              <dd>
                {data.electoralZone
                  ? `Zona ${data.electoralZone.number} · ${data.electoralZone.name}`
                  : "—"}
              </dd>
              <dt>Local</dt>
              <dd>{data.pollingPlace?.name ?? "—"}</dd>
              <dt>Proprietário</dt>
              <dd>{data.ownerName}</dd>
              <dt>Responsável</dt>
              <dd>{data.responsibleName}</dd>
              <dt>Identificado em</dt>
              <dd>{formatDate(data.identifiedAt)}</dd>
              <dt>Prazo</dt>
              <dd className={data.overdue ? styles.dangerText : undefined}>
                {data.dueDate ? formatDate(data.dueDate) : "sem prazo"}
                {data.overdue && " · vencido"}
              </dd>
              <dt>Atualizado em</dt>
              <dd>{formatDateTime(data.updatedAt)}</dd>
            </dl>
          </Card>

          <Card>
            <h2>Ações</h2>
            <div className={styles.actions}>
              {data.status !== "CLOSED" && (
                <Button
                  disabled={saving}
                  onClick={() => void act(() => riskService.close(id), "Risco encerrado.")}
                >
                  Encerrar risco
                </Button>
              )}
              {data.status === "IDENTIFIED" && data.mitigationCount === 0 && (
                <Button
                  disabled={saving}
                  onClick={() => {
                    if (!window.confirm("Excluir este risco do registro?")) return;
                    void riskService
                      .remove(id)
                      .then(() => navigate("/risks/list"))
                      .catch((reason: unknown) =>
                        setError(
                          reason instanceof Error ? reason : new Error("Não foi possível excluir."),
                        ),
                      );
                  }}
                >
                  Excluir risco não tratado
                </Button>
              )}
              <small className={styles.mutedText}>
                Riscos com plano de mitigação ou já avaliados são preservados para
                histórico — encerre em vez de excluir.
              </small>
            </div>
          </Card>
        </div>
      </div>

      <Card>
        <h2>Histórico</h2>
        <RiskTimeline events={data.timeline ?? []} />
      </Card>
    </section>
  );
}
