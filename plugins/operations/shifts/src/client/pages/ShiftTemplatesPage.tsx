import { useState, type FormEvent } from "react";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Loading,
  Select,
  useAsync,
} from "@eops/ui";
import { useNavigate } from "react-router-dom";
import { ShiftsNav } from "../components/ShiftsNav";
import { shiftsService } from "../services/shiftsService";
import styles from "../styles/shifts.module.css";

export function ShiftTemplatesPage() {
  const navigate = useNavigate();
  const references = useAsync(shiftsService.references, []);
  const templates = useAsync(shiftsService.templates, []);
  const [form, setForm] = useState({
    teamId: "",
    name: "",
    startMinute: 480,
    durationMinutes: 360,
    requiredOperators: 1,
  });
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<Error>();
  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      await shiftsService.createTemplate(form);
      setForm((value) => ({ ...value, name: "" }));
      templates.reload();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason
          : new Error("Falha ao criar template."),
      );
    }
  }
  async function instantiate(id: string) {
    try {
      const shift = await shiftsService.createFromTemplate(id, date);
      navigate("/shifts/" + shift.id);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason : new Error("Falha ao criar turno."),
      );
    }
  }
  return (
    <section className={styles.page}>
      <ShiftsNav />
      <header className={styles.header}>
        <div>
          <span>RECORRÃŠNCIA SEM DUPLICAR ESTADO</span>
          <h1>Templates de turno</h1>
          <p>
            Templates criam novos turnos sem copiar presenÃ§a, ausÃªncia ou
            histÃ³rico.
          </p>
        </div>
      </header>
      {error && <ErrorState error={error} />}
      <div className={styles.detailGrid}>
        <Card>
          <h2>Novo template</h2>
          {references.loading && <Loading />}
          {references.error && (
            <ErrorState error={references.error} onRetry={references.reload} />
          )}
          {references.data && (
            <form
              className={styles.form}
              onSubmit={(event) => void submit(event)}
            >
              <Field label="Equipe">
                <Select
                  required
                  value={form.teamId}
                  onChange={(event) =>
                    setForm((value) => ({
                      ...value,
                      teamId: event.target.value,
                    }))
                  }
                >
                  <option value="">Selecione</option>
                  {references.data.teams
                    .filter((team) => team.status === "ACTIVE")
                    .map((team) => (
                      <option value={team.id} key={team.id}>
                        {team.name}
                      </option>
                    ))}
                </Select>
              </Field>
              <Field label="Nome">
                <Input
                  required
                  value={form.name}
                  onChange={(event) =>
                    setForm((value) => ({ ...value, name: event.target.value }))
                  }
                />
              </Field>
              <Field label="Minuto inicial do dia">
                <Input
                  type="number"
                  min={0}
                  max={1439}
                  value={form.startMinute}
                  onChange={(event) =>
                    setForm((value) => ({
                      ...value,
                      startMinute: Number(event.target.value),
                    }))
                  }
                />
              </Field>
              <Field label="DuraÃ§Ã£o (min)">
                <Input
                  type="number"
                  min={1}
                  value={form.durationMinutes}
                  onChange={(event) =>
                    setForm((value) => ({
                      ...value,
                      durationMinutes: Number(event.target.value),
                    }))
                  }
                />
              </Field>
              <Field label="Pessoas necessÃ¡rias">
                <Input
                  type="number"
                  min={1}
                  value={form.requiredOperators}
                  onChange={(event) =>
                    setForm((value) => ({
                      ...value,
                      requiredOperators: Number(event.target.value),
                    }))
                  }
                />
              </Field>
              <Button type="submit">Salvar template</Button>
            </form>
          )}
        </Card>
        <Card>
          <h2>Templates ativos</h2>
          {templates.loading && <Loading />}
          {templates.error && (
            <ErrorState error={templates.error} onRetry={templates.reload} />
          )}
          {templates.data?.length === 0 && (
            <EmptyState
              title="Nenhum template"
              description="Cadastre uma configuraÃ§Ã£o recorrente."
            />
          )}
          <Field label="Data do novo turno">
            <Input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </Field>
          <div className={styles.assignmentList}>
            {templates.data?.map((template) => (
              <article className={styles.assignmentItem} key={template.id}>
                <div>
                  <strong>{template.name}</strong>
                  <small>
                    {template.team.name} Â· {template.requiredOperators} pessoas
                    Â· {template.durationMinutes} min
                  </small>
                </div>
                <span>{template.active ? "Ativo" : "Inativo"}</span>
                <Button
                  disabled={!template.active}
                  onClick={() => void instantiate(template.id)}
                >
                  Criar turno
                </Button>
              </article>
            ))}
          </div>
        </Card>
      </div>
    </section>
  );
}
