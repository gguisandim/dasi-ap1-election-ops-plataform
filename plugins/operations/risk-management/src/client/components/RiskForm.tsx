import { useState, type FormEvent } from "react";
import { Button, ErrorState, Field, Input, Select } from "@eops/ui";
import {
  RISK_LEVEL_BANDS,
  RISK_LEVEL_LABELS,
  RISK_SCALE,
  RISK_SCALE_LABELS,
  RISK_SCALE_VALUES,
  RISK_STATUSES,
  RISK_STATUS_LABELS,
  type RiskInput,
  type RiskLevel,
  type RiskScaleValue,
  type RiskStatus,
} from "@eops/shared/risks";
import type { RiskReferenceData } from "../services/riskService";
import styles from "../styles/risk.module.css";

export type RiskFormValue = RiskInput;

export const emptyRiskForm = (): RiskFormValue => ({
  title: "",
  description: "",
  electionId: "",
  electoralZoneId: undefined,
  pollingPlaceId: undefined,
  categoryId: "",
  ownerName: "",
  responsibleName: "",
  probability: "MEDIUM",
  impact: "MEDIUM",
  status: undefined,
  identifiedAt: undefined,
  dueDate: undefined,
  observations: "",
});

/** Score e classificação calculados no cliente apenas para pré-visualização. */
function previewLevel(probability: RiskScaleValue, impact: RiskScaleValue): {
  score: number;
  level: RiskLevel;
} {
  const score = RISK_SCALE_VALUES[probability] * RISK_SCALE_VALUES[impact];
  const band = RISK_LEVEL_BANDS.find((entry) => score <= entry.maxScore);
  return { score, level: band?.level ?? "CRITICAL" };
}

/**
 * Formulário de risco.
 *
 * O score é exibido enquanto o usuário escolhe probabilidade e impacto, mas
 * **não** é enviado: o servidor recalcula e é a única fonte de verdade da
 * classificação.
 */
export function RiskForm({
  value,
  references,
  saving,
  error,
  editing,
  submitLabel,
  onChange,
  onSubmit,
  onCancel,
}: {
  value: RiskFormValue;
  references: RiskReferenceData;
  saving: boolean;
  error?: Error;
  editing: boolean;
  submitLabel: string;
  onChange: (value: RiskFormValue) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  const [ownerQuery, setOwnerQuery] = useState("");
  const set = <K extends keyof RiskFormValue>(key: K, next: RiskFormValue[K]) =>
    onChange({ ...value, [key]: next });

  const preview = previewLevel(value.probability, value.impact);
  const zones = references.zones.filter(
    (zone) => !value.electionId || zone.electionId === value.electionId,
  );
  const places = references.places.filter(
    (place) => !value.electoralZoneId || place.electoralZoneId === value.electoralZoneId,
  );
  const ownerSuggestions = references.users.filter((user) =>
    ownerQuery.length >= 2
      ? user.name.toLowerCase().includes(ownerQuery.toLowerCase())
      : false,
  );

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <form className={styles.form} onSubmit={submit}>
      {error && <ErrorState error={error} />}

      <div className={styles.formGrid}>
        <Field label="Pleito">
          <Select
            required
            disabled={editing}
            value={value.electionId}
            onChange={(event) => set("electionId", event.target.value)}
          >
            <option value="">Selecione</option>
            {references.elections.map((election) => (
              <option key={election.id} value={election.id}>
                {election.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Categoria">
          <Select
            required
            value={value.categoryId}
            onChange={(event) => set("categoryId", event.target.value)}
          >
            <option value="">Selecione</option>
            {references.categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Zona (opcional)">
          <Select
            value={value.electoralZoneId ?? ""}
            onChange={(event) =>
              onChange({
                ...value,
                electoralZoneId: event.target.value || undefined,
                pollingPlaceId: undefined,
              })
            }
          >
            <option value="">Sem zona específica</option>
            {zones.map((zone) => (
              <option key={zone.id} value={zone.id}>
                Zona {zone.number} · {zone.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Local (opcional)">
          <Select
            value={value.pollingPlaceId ?? ""}
            onChange={(event) => set("pollingPlaceId", event.target.value || undefined)}
          >
            <option value="">Sem local específico</option>
            {places.map((place) => (
              <option key={place.id} value={place.id}>
                {place.name} — {place.city}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Data de identificação">
          <Input
            type="date"
            value={value.identifiedAt?.slice(0, 10) ?? ""}
            onChange={(event) => set("identifiedAt", event.target.value || undefined)}
          />
        </Field>
        <Field label="Prazo de tratamento">
          <Input
            type="date"
            value={value.dueDate?.slice(0, 10) ?? ""}
            onChange={(event) => set("dueDate", event.target.value || undefined)}
          />
        </Field>
      </div>

      <Field label="Título">
        <Input
          required
          minLength={3}
          maxLength={180}
          value={value.title}
          onChange={(event) => set("title", event.target.value)}
        />
      </Field>

      <Field label="Descrição">
        <textarea
          required
          className={styles.textarea}
          minLength={3}
          maxLength={4000}
          value={value.description}
          onChange={(event) => set("description", event.target.value)}
        />
      </Field>

      <div className={styles.formGrid}>
        <Field label="Proprietário do risco">
          <Input
            required
            minLength={2}
            maxLength={160}
            placeholder="Quem responde pelo risco"
            value={value.ownerName}
            onChange={(event) => {
              set("ownerName", event.target.value);
              setOwnerQuery(event.target.value);
            }}
          />
        </Field>
        <Field label="Responsável pelo tratamento">
          <Input
            required
            minLength={2}
            maxLength={160}
            value={value.responsibleName}
            onChange={(event) => set("responsibleName", event.target.value)}
          />
        </Field>
        {editing && (
          <Field label="Situação">
            <Select
              value={value.status ?? ""}
              onChange={(event) =>
                set("status", (event.target.value || undefined) as RiskStatus | undefined)
              }
            >
              <option value="">Manter situação atual</option>
              {RISK_STATUSES.filter((status) => status !== "MATERIALIZED").map((status) => (
                <option key={status} value={status}>
                  {RISK_STATUS_LABELS[status]}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </div>

      {ownerSuggestions.length > 0 && (
        <div className={styles.suggestions}>
          {ownerSuggestions.slice(0, 5).map((user) => (
            <button
              key={user.id}
              type="button"
              onClick={() => {
                set("ownerName", user.name);
                setOwnerQuery("");
              }}
            >
              {user.name} · {user.email}
            </button>
          ))}
        </div>
      )}

      <div className={styles.assessmentRow}>
        <Field label="Probabilidade">
          <Select
            value={value.probability}
            onChange={(event) => set("probability", event.target.value as RiskScaleValue)}
          >
            {RISK_SCALE.map((scale) => (
              <option key={scale} value={scale}>
                {RISK_SCALE_LABELS[scale]} ({RISK_SCALE_VALUES[scale]})
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Impacto">
          <Select
            value={value.impact}
            onChange={(event) => set("impact", event.target.value as RiskScaleValue)}
          >
            {RISK_SCALE.map((scale) => (
              <option key={scale} value={scale}>
                {RISK_SCALE_LABELS[scale]} ({RISK_SCALE_VALUES[scale]})
              </option>
            ))}
          </Select>
        </Field>
        <div className={styles.assessmentPreview}>
          <span>Score calculado</span>
          <strong>{preview.score}</strong>
          <small>{RISK_LEVEL_LABELS[preview.level]}</small>
          <small className={styles.mutedText}>
            Confirmado pelo servidor ao salvar
          </small>
        </div>
      </div>

      <Field label="Observações">
        <textarea
          className={styles.textareaSmall}
          maxLength={2000}
          value={value.observations ?? ""}
          onChange={(event) => set("observations", event.target.value)}
        />
      </Field>

      <div className={styles.actions}>
        <Button disabled={saving} type="submit">
          {saving ? "Salvando…" : submitLabel}
        </Button>
        <Button type="button" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
