import {
  Button,
  ErrorState,
  Field,
  Input,
  Loading,
  Select,
  useAsync,
} from "@eops/ui";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ShiftsNav } from "../components/ShiftsNav";
import { shiftsService } from "../services/shiftsService";
import styles from "../styles/shifts.module.css";

export function NewShiftPage() {
  const navigate = useNavigate();
  const references = useAsync(shiftsService.references, []);
  const [form, setForm] = useState({
    electionId: "",
    teamId: "",
    name: "",
    startsAt: "",
    endsAt: "",
    requiredOperators: 2,
    electoralZoneId: "",
    pollingPlaceId: "",
    notes: "",
    specialtyIds: [] as string[],
  });
  const [error, setError] = useState<Error>();

  const teams =
    references.data?.teams.filter(
      (team) => !form.electionId || team.electionId === form.electionId,
    ) ?? [];
  const zones =
    references.data?.zones.filter(
      (zone) => !form.electionId || zone.electionId === form.electionId,
    ) ?? [];
  const places =
    references.data?.places.filter(
      (place) =>
        !form.electoralZoneId || place.electoralZoneId === form.electoralZoneId,
    ) ?? [];

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(undefined);
    try {
      const created = await shiftsService.create({
        electionId: form.electionId,
        teamId: form.teamId,
        name: form.name,
        startsAt: new Date(form.startsAt).toISOString(),
        endsAt: new Date(form.endsAt).toISOString(),
        requiredOperators: form.requiredOperators,
        electoralZoneId: form.electoralZoneId || undefined,
        pollingPlaceId: form.pollingPlaceId || undefined,
        notes: form.notes || undefined,
        specialtyRequirements: form.specialtyIds.map((specialtyId) => ({
          specialtyId,
          requiredCount: 1,
        })),
      });
      navigate(`/shifts/${created.id}`);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason
          : new Error("Não foi possível criar o turno."),
      );
    }
  }

  return (
    <section className={styles.page}>
      <ShiftsNav />
      <header className={styles.header}>
        <div>
          <span>NOVO TURNO</span>
          <h1>Criar escala</h1>
          <p>Defina período, equipe, local e cobertura mínima.</p>
        </div>
      </header>

      {references.loading && <Loading label="Carregando referências…" />}
      {(references.error || error) && (
        <ErrorState
          error={error ?? references.error}
          onRetry={references.reload}
        />
      )}

      {references.data && (
        <form className={styles.form} onSubmit={submit}>
          <Field label="Pleito">
            <Select
              required
              value={form.electionId}
              onChange={(event) =>
                setForm((old) => ({
                  ...old,
                  electionId: event.target.value,
                  teamId: "",
                  electoralZoneId: "",
                  pollingPlaceId: "",
                }))
              }
            >
              <option value="">Selecione</option>
              {references.data.elections.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {item.year}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Equipe">
            <Select
              required
              value={form.teamId}
              onChange={(event) =>
                setForm((old) => ({ ...old, teamId: event.target.value }))
              }
            >
              <option value="">Selecione</option>
              {teams.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Nome do turno" className="wide">
            <Input
              required
              minLength={2}
              maxLength={120}
              value={form.name}
              onChange={(event) =>
                setForm((old) => ({ ...old, name: event.target.value }))
              }
            />
          </Field>

          <Field label="Início">
            <Input
              required
              type="datetime-local"
              value={form.startsAt}
              onChange={(event) =>
                setForm((old) => ({ ...old, startsAt: event.target.value }))
              }
            />
          </Field>

          <Field label="Fim">
            <Input
              required
              type="datetime-local"
              value={form.endsAt}
              onChange={(event) =>
                setForm((old) => ({ ...old, endsAt: event.target.value }))
              }
            />
          </Field>

          <Field label="Operadores mínimos">
            <Input
              required
              type="number"
              min={1}
              value={form.requiredOperators}
              onChange={(event) =>
                setForm((old) => ({
                  ...old,
                  requiredOperators: Number(event.target.value),
                }))
              }
            />
          </Field>

          <Field label="Especialidades obrigatórias" className="wide">
            <Select
              multiple
              value={form.specialtyIds}
              onChange={(event) =>
                setForm((old) => ({
                  ...old,
                  specialtyIds: [...event.target.selectedOptions].map(
                    (option) => option.value,
                  ),
                }))
              }
            >
              {references.data.specialties.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} (1)
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Zona eleitoral">
            <Select
              value={form.electoralZoneId}
              onChange={(event) =>
                setForm((old) => ({
                  ...old,
                  electoralZoneId: event.target.value,
                  pollingPlaceId: "",
                }))
              }
            >
              <option value="">Todas</option>
              {zones.map((item) => (
                <option key={item.id} value={item.id}>
                  Zona {item.number} · {item.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Local de votação">
            <Select
              value={form.pollingPlaceId}
              onChange={(event) =>
                setForm((old) => ({
                  ...old,
                  pollingPlaceId: event.target.value,
                }))
              }
            >
              <option value="">Nenhum</option>
              {places.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Observações" className="wide">
            <textarea
              value={form.notes}
              onChange={(event) =>
                setForm((old) => ({ ...old, notes: event.target.value }))
              }
            />
          </Field>

          <div className={`${styles.actions} wide`}>
            <Button type="submit">Salvar turno</Button>
          </div>
        </form>
      )}
    </section>
  );
}
