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
  ElectoralZoneSummary,
  MonitoringStatus,
  ResourceStatus,
} from "@eops/shared";
import { apiClient } from "@eops/api-client";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  pollingPlaceService,
  type PlaceInput,
} from "../services/pollingPlaceService";
import styles from "../styles/places.module.css";
export function PollingPlaceFormPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const zones = useAsync(
    () => apiClient.get<ElectoralZoneSummary[]>("/electoral-zones"),
    [],
  );
  const [form, setForm] = useState<PlaceInput>({
    electoralZoneId: params.get("zoneId") ?? "",
    name: "",
    address: "",
    district: "",
    city: "",
    state: "PA",
    latitude: undefined,
    longitude: undefined,
    status: "ACTIVE",
    monitoringStatus: "NORMAL",
  });
  const [loading, setLoading] = useState(Boolean(id));
  const [error, setError] = useState<Error>();
  useEffect(() => {
    if (id)
      pollingPlaceService
        .get(id)
        .then((place) =>
          setForm({
            electoralZoneId: place.electoralZoneId,
            name: place.name,
            address: place.address,
            district: place.district,
            city: place.city,
            state: place.state,
            latitude: place.latitude ?? undefined,
            longitude: place.longitude ?? undefined,
            status: place.status,
            monitoringStatus: place.monitoringStatus,
          }),
        )
        .catch(setError)
        .finally(() => setLoading(false));
  }, [id]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      const saved = id
        ? await pollingPlaceService.update(id, form)
        : await pollingPlaceService.create(form);
      navigate(`/polling-places/${saved.id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason : new Error('Erro inesperado ao salvar.'));
    }
  }
  if (loading || zones.loading) return <Loading />;
  return (
    <section className={styles.page}>
      <Breadcrumb
        items={[
          { label: "Locais", to: "/polling-places" },
          { label: id ? "Editar" : "Novo local" },
        ]}
      />
      <h1>{id ? "Editar local" : "Novo local de votação"}</h1>
      {error && <ErrorState error={error} />}
      <form className={styles.form} onSubmit={(event) => void submit(event)}>
        <Field label="Zona eleitoral">
          <Select
            required
            value={form.electoralZoneId}
            onChange={(event) =>
              setForm({ ...form, electoralZoneId: event.target.value })
            }
          >
            <option value="">Selecione</option>
            {zones.data?.map((zone) => (
              <option key={zone.id} value={zone.id}>
                Zona {zone.number} · {zone.municipality}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Nome">
          <Input
            required
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
        </Field>
        <Field label="Endereço">
          <Input
            required
            value={form.address}
            onChange={(event) =>
              setForm({ ...form, address: event.target.value })
            }
          />
        </Field>
        <div className={styles.formGrid}>
          <Field label="Bairro">
            <Input
              required
              value={form.district}
              onChange={(event) =>
                setForm({ ...form, district: event.target.value })
              }
            />
          </Field>
          <Field label="Município">
            <Input
              required
              value={form.city}
              onChange={(event) =>
                setForm({ ...form, city: event.target.value })
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
        </div>
        <div className={styles.formGrid}>
          <Field label="Latitude">
            <Input
              type="number"
              step="any"
              min={-90}
              max={90}
              value={form.latitude ?? ""}
              onChange={(event) =>
                setForm({
                  ...form,
                  latitude: event.target.value
                    ? Number(event.target.value)
                    : undefined,
                })
              }
            />
          </Field>
          <Field label="Longitude">
            <Input
              type="number"
              step="any"
              min={-180}
              max={180}
              value={form.longitude ?? ""}
              onChange={(event) =>
                setForm({
                  ...form,
                  longitude: event.target.value
                    ? Number(event.target.value)
                    : undefined,
                })
              }
            />
          </Field>
          <Field label="Monitoramento">
            <Select
              value={form.monitoringStatus}
              onChange={(event) =>
                setForm({
                  ...form,
                  monitoringStatus: event.target.value as MonitoringStatus,
                })
              }
            >
              {["NORMAL", "ATTENTION", "CRITICAL", "OFFLINE"].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </Select>
          </Field>
          <Field label="Cadastro">
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
