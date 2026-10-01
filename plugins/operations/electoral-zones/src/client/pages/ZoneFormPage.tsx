import { useEffect, useState, type FormEvent } from "react";
import {
  Breadcrumb,
  Button,
  ErrorState,
  Field,
  Input,
  Loading,
  Select,
  useAsync,
} from "@eops/ui";
import type { ElectionSummary, ResourceStatus } from "@eops/shared/elections";
import { apiClient } from "@eops/api-client";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  electoralZoneService,
  type ZoneInput,
} from "../services/electoralZoneService";
import styles from "../styles/zones.module.css";
export function ZoneFormPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const elections = useAsync(
    () => apiClient.get<ElectionSummary[]>("/elections"),
    [],
  );
  const [form, setForm] = useState<ZoneInput>({
    electionId: params.get("electionId") ?? "",
    number: 1,
    name: "",
    municipality: "",
    state: "PA",
    status: "ACTIVE",
  });
  const [loading, setLoading] = useState(Boolean(id));
  const [error, setError] = useState<Error>();
  useEffect(() => {
    if (id)
      electoralZoneService
        .get(id)
        .then((zone) =>
          setForm({
            electionId: zone.electionId,
            number: zone.number,
            name: zone.name,
            municipality: zone.municipality,
            state: zone.state,
            status: zone.status,
          }),
        )
        .catch(setError)
        .finally(() => setLoading(false));
  }, [id]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      const saved = id
        ? await electoralZoneService.update(id, form)
        : await electoralZoneService.create(form);
      navigate(`/electoral-zones/${saved.id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason : new Error('Erro inesperado ao salvar.'));
    }
  }
  if (loading || elections.loading) return <Loading />;
  return (
    <section className={styles.page}>
      <Breadcrumb
        items={[
          { label: "Zonas", to: "/electoral-zones" },
          { label: id ? "Editar" : "Nova zona" },
        ]}
      />
      <h1>{id ? "Editar zona" : "Nova zona eleitoral"}</h1>
      {error && <ErrorState error={error} />}
      <form className={styles.form} onSubmit={(event) => void submit(event)}>
        <Field label="Pleito">
          <Select
            required
            value={form.electionId}
            onChange={(event) =>
              setForm({ ...form, electionId: event.target.value })
            }
          >
            <option value="">Selecione</option>
            {elections.data?.map((election) => (
              <option key={election.id} value={election.id}>
                {election.name}
              </option>
            ))}
          </Select>
        </Field>
        <div className={styles.formGrid}>
          <Field label="Número">
            <Input
              required
              type="number"
              min={1}
              value={form.number}
              onChange={(event) =>
                setForm({ ...form, number: Number(event.target.value) })
              }
            />
          </Field>
          <Field label="Nome">
            <Input
              required
              value={form.name}
              onChange={(event) =>
                setForm({ ...form, name: event.target.value })
              }
            />
          </Field>
        </div>
        <div className={styles.formGrid}>
          <Field label="Município">
            <Input
              required
              value={form.municipality}
              onChange={(event) =>
                setForm({ ...form, municipality: event.target.value })
              }
            />
          </Field>
          <Field label="UF">
            <Input
              required
              maxLength={2}
              value={form.state}
              onChange={(event) =>
                setForm({ ...form, state: event.target.value.toUpperCase() })
              }
            />
          </Field>
          <Field label="Status">
            <Select
              value={form.status}
              onChange={(event) =>
                setForm({
                  ...form,
                  status: event.target.value as ResourceStatus,
                })
              }
            >
              <option value="ACTIVE">Ativo</option>
              <option value="INACTIVE">Inativo</option>
            </Select>
          </Field>
        </div>
        <div>
          <Button type="button" onClick={() => navigate(-1)}>
            Cancelar
          </Button>{" "}
          <Button type="submit">Salvar</Button>
        </div>
      </form>
    </section>
  );
}
