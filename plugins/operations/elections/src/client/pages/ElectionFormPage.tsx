import { useEffect, useState, type FormEvent } from "react";
import {
  Breadcrumb,
  Button,
  ErrorState,
  Field,
  Input,
  Loading,
  Select,
} from "@eops/ui";
import {
  ELECTION_STATUSES,
  ELECTION_TYPES,
  STATUS_LABELS,
  TYPE_LABELS,
  type ElectionStatus,
  type ElectionType,
} from "@eops/shared";
import { useNavigate, useParams } from "react-router-dom";
import {
  electionService,
  type ElectionInput,
} from "../services/electionService";
import styles from "../styles/elections.module.css";

const empty: ElectionInput = {
  name: "",
  description: "",
  year: new Date().getFullYear(),
  type: "GENERAL",
  status: "PLANNING",
  rounds: [
    { roundNumber: 1, date: "", status: "SCHEDULED" },
    { roundNumber: 2, date: "", status: "SCHEDULED" },
  ],
};

export function ElectionFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState<ElectionInput>(empty);
  const [loading, setLoading] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<Error>();
  useEffect(() => {
    if (id)
      electionService
        .get(id)
        .then((value) =>
          setForm({
            name: value.name,
            description: value.description ?? "",
            year: value.year,
            type: value.type,
            status: value.status,
            rounds: value.rounds.map((round) => ({
              roundNumber: round.roundNumber,
              status: round.status,
              date: round.date.slice(0, 10),
            })),
          }),
        )
        .catch(setError)
        .finally(() => setLoading(false));
  }, [id]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(undefined);
    try {
      const payload = {
        ...form,
        rounds: form.rounds
          ?.filter((round) => round.date)
          .map((round) => ({
            ...round,
            date: new Date(`${round.date}T12:00:00Z`).toISOString(),
          })),
      };
      const saved = id
        ? await electionService.update(id, {
            name: payload.name,
            description: payload.description,
            year: payload.year,
            type: payload.type,
            status: payload.status,
          })
        : await electionService.create(payload);
      navigate(`/elections/${saved.id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason : new Error('Erro inesperado ao salvar.'));
    } finally {
      setSaving(false);
    }
  }
  if (loading) return <Loading label="Carregando formulário…" />;
  return (
    <section className={styles.page}>
      <Breadcrumb
        items={[
          { label: "Pleitos", to: "/elections" },
          { label: id ? "Editar" : "Novo pleito" },
        ]}
      />
      <h1>{id ? "Editar pleito" : "Novo pleito"}</h1>
      {error && <ErrorState error={error} />}
      <form className={styles.form} onSubmit={(event) => void submit(event)}>
        <Field label="Nome">
          <Input
            required
            minLength={3}
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
        </Field>
        <Field label="Descrição">
          <Input
            value={form.description ?? ""}
            onChange={(event) =>
              setForm({ ...form, description: event.target.value })
            }
          />
        </Field>
        <div className={styles.formGrid}>
          <Field label="Ano">
            <Input
              required
              type="number"
              min={2000}
              max={2200}
              value={form.year}
              onChange={(event) =>
                setForm({ ...form, year: Number(event.target.value) })
              }
            />
          </Field>
          <Field label="Tipo">
            <Select
              value={form.type}
              onChange={(event) =>
                setForm({ ...form, type: event.target.value as ElectionType })
              }
            >
              {ELECTION_TYPES.map((type) => (
                <option key={type} value={type}>
                  {TYPE_LABELS[type]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Status">
            <Select
              value={form.status}
              onChange={(event) =>
                setForm({
                  ...form,
                  status: event.target.value as ElectionStatus,
                })
              }
            >
              {ELECTION_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABELS[status]}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        {!id && (
          <fieldset>
            <legend>Turnos</legend>
            {form.rounds?.map((round, index) => (
              <Field
                key={round.roundNumber}
                label={`${round.roundNumber}º turno`}
              >
                <Input
                  type="date"
                  required={index === 0}
                  value={round.date}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      rounds: form.rounds?.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, date: event.target.value }
                          : item,
                      ),
                    })
                  }
                />
              </Field>
            ))}
          </fieldset>
        )}
        <div className={styles.actions}>
          <Button type="button" onClick={() => navigate(-1)}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Salvando…" : "Salvar pleito"}
          </Button>
        </div>
      </form>
    </section>
  );
}
