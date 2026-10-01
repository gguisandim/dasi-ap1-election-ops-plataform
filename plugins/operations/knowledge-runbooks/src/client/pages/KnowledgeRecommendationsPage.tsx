import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button, Card, ErrorState, Field, Input, LinkButton, Loading, Select } from "@eops/ui";
import { RecommendationList, ScoringLegend } from "../components/RecommendationList";
import {
  useKnowledgeReferenceData,
  useRecommendations,
} from "../hooks/useKnowledge";
import type { RecommendationQuery } from "../services/knowledgeService";
import styles from "../styles/knowledge.module.css";

const SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

/**
 * Recomendações de runbook.
 *
 * Duas formas de consulta: por incidente existente (o contexto vem do próprio
 * registro) ou por critérios avulsos, útil quando o incidente ainda não foi
 * aberto. O score de cada resultado vem com os componentes que o formaram.
 */
export function KnowledgeRecommendationsPage() {
  const [searchParams] = useSearchParams();
  const references = useKnowledgeReferenceData();
  const [incidentId, setIncidentId] = useState(searchParams.get("incidentId") ?? "");
  const [categoryKey, setCategoryKey] = useState("");
  const [severity, setSeverity] = useState("");
  const [assetTypeKey, setAssetTypeKey] = useState("");
  const [text, setText] = useState("");
  const [submitted, setSubmitted] = useState<RecommendationQuery | undefined>(
    searchParams.get("incidentId") ? { incidentId: searchParams.get("incidentId") ?? undefined } : undefined,
  );

  const recommendations = useRecommendations(submitted);

  if (references.loading) return <Loading label="Carregando dados de apoio…" />;
  if (references.error || !references.data) {
    return (
      <ErrorState
        error={references.error ?? new Error("Dados de apoio indisponíveis.")}
        onRetry={references.reload}
      />
    );
  }

  const byIncident = () => setSubmitted(incidentId ? { incidentId, limit: 8 } : undefined);

  const byCriteria = () =>
    setSubmitted({
      categoryKey: categoryKey || undefined,
      severity: severity || undefined,
      assetTypeKey: assetTypeKey || undefined,
      text: text || undefined,
      limit: 8,
    });

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>CONHECIMENTO</span>
          <h1>Recomendações de runbook</h1>
          <p>
            A pontuação é uma regra publicada, não uma caixa-preta: cada resultado mostra
            por que foi sugerido.
          </p>
        </div>
        <div className={styles.headerActions}>
          <LinkButton to="/knowledge" secondary>
            Voltar à base
          </LinkButton>
          <LinkButton to="/knowledge/new?kind=RUNBOOK">Novo runbook</LinkButton>
        </div>
      </header>

      <div className={styles.recommendationGrid}>
        <Card>
          <h2>A partir de um incidente</h2>
          <Field label="Incidente aberto">
            <Select value={incidentId} onChange={(event) => setIncidentId(event.target.value)}>
              <option value="">Selecione</option>
              {references.data.incidents.map((incident) => (
                <option key={incident.id} value={incident.id}>
                  {incident.code} · {incident.title}
                </option>
              ))}
            </Select>
          </Field>
          <Button disabled={!incidentId} onClick={byIncident}>
            Recomendar
          </Button>
        </Card>

        <Card>
          <h2>A partir de critérios</h2>
          <div className={styles.formGrid}>
            <Field label="Categoria de incidente">
              <Select value={categoryKey} onChange={(event) => setCategoryKey(event.target.value)}>
                <option value="">Qualquer</option>
                {references.data.incidentCategories.map((category) => (
                  <option key={category.key} value={category.key}>
                    {category.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Severidade">
              <Select value={severity} onChange={(event) => setSeverity(event.target.value)}>
                <option value="">Qualquer</option>
                {SEVERITIES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Tipo de ativo">
              <Select
                value={assetTypeKey}
                onChange={(event) => setAssetTypeKey(event.target.value)}
              >
                <option value="">Qualquer</option>
                {references.data.assetTypes.map((type) => (
                  <option key={type.key} value={type.key}>
                    {type.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Texto do problema">
            <Input
              placeholder="Ex.: enlace de rede caiu e não reconecta"
              value={text}
              onChange={(event) => setText(event.target.value)}
            />
          </Field>
          <Button onClick={byCriteria}>Recomendar</Button>
        </Card>

        <Card>
          <h2>Como o score é calculado</h2>
          <ScoringLegend />
          <small className={styles.mutedText}>
            Empates são desempatados por quem já resolveu mais, maior taxa de sucesso e
            maior número de usos.
          </small>
        </Card>
      </div>

      <Card>
        <h2>Runbooks recomendados</h2>
        {!submitted && (
          <p className={styles.mutedText}>
            Informe um incidente ou critérios para receber sugestões.
          </p>
        )}
        {submitted && recommendations.loading && <Loading label="Calculando recomendação…" />}
        {submitted && recommendations.error && (
          <ErrorState error={recommendations.error} onRetry={recommendations.reload} />
        )}
        {submitted && recommendations.data && (
          <RecommendationList items={recommendations.data} />
        )}
      </Card>
    </section>
  );
}
