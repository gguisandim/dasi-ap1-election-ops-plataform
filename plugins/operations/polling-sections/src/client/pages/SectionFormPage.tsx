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
import type {
  Paginated,
  PollingPlaceSummary,
  ResourceStatus,
} from "@eops/shared";
import { apiClient } from "@eops/api-client";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  pollingSectionService,
  type SectionInput,
} from "../services/pollingSectionService";
import styles from "../styles/sections.module.css";
export function SectionFormPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const places = useAsync(
    () =>
      apiClient.get<Paginated<PollingPlaceSummary>>("/polling-places", {
        query: { pageSize: 100 },
      }),
    [],
  );
  const [form, setForm] = useState<SectionInput>({
    pollingPlaceId: params.get("pollingPlaceId") ?? "",
    number: 1,
    registeredVoters: 0,
    status: "ACTIVE",
  });
  const [loading, setLoading] = useState(Boolean(id));
  const [error, setError] = useState<Error>();
  useEffect(() => {
    if (id)
      pollingSectionService
        .get(id)
        .then((section) =>
          setForm({
            pollingPlaceId: section.pollingPlaceId,
            number: section.number,
            registeredVoters: section.registeredVoters,
            status: section.status,
          }),
        )
        .catch(setError)
        .finally(() => setLoading(false));
  }, [id]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      const saved = id
        ? await pollingSectionService.update(id, form)
        : await pollingSectionService.create(form);
      navigate(`/polling-sections/${saved.id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason : new Error('Erro inesperado ao salvar.'));
    }
  }
  if (loading || places.loading) return <Loading />;
  return (
    <section className={styles.page}>
      <Breadcrumb
        items={[
          { label: "Seções", to: "/polling-sections" },
          { label: id ? "Editar" : "Nova seção" },
        ]}
      />
      <h1>{id ? "Editar seção" : "Nova seção eleitoral"}</h1>
      {error && <ErrorState error={error} />}
      <form className={styles.form} onSubmit={(event) => void submit(event)}>
        <Field label="Local de votação">
          <Select
            required
            value={form.pollingPlaceId}
            onChange={(event) =>
              setForm({ ...form, pollingPlaceId: event.target.value })
            }
          >
            <option value="">Selecione</option>
            {places.data?.items.map((place) => (
              <option key={place.id} value={place.id}>
                {place.name} · Zona {place.electoralZone.number}
              </option>
            ))}
          </Select>
        </Field>
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
        <Field label="Eleitores registrados">
          <Input
            required
            type="number"
            min={0}
            max={1000}
            value={form.registeredVoters}
            onChange={(event) =>
              setForm({ ...form, registeredVoters: Number(event.target.value) })
            }
          />
        </Field>
        <Field label="Status">
          <Select
            value={form.status}
            onChange={(event) =>
              setForm({ ...form, status: event.target.value as ResourceStatus })
            }
          >
            <option value="ACTIVE">Ativo</option>
            <option value="INACTIVE">Inativo</option>
          </Select>
        </Field>
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
