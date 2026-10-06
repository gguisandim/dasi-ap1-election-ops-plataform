import { useEffect, useState } from "react";
import {
  Breadcrumb,
  Button,
  EmptyState,
  ErrorState,
  Field,
  Input,
  LinkButton,
  Loading,
  Select,
  useAsync,
} from "@eops/ui";
import {
  RESOURCE_REQUEST_ITEM_KIND_LABELS,
  RESOURCE_REQUEST_PRIORITIES,
  RESOURCE_REQUEST_PRIORITY_LABELS,
  RESOURCE_REQUEST_STATUS_LABELS,
  type ResourceRequestItemKind,
  type ResourceRequestPriority,
} from "@eops/shared/resource-requests";
import { useNavigate, useParams } from "react-router-dom";
import { resourceRequestsService } from "../services/resourceRequestsService";
import type { RequestItemInput } from "../../types";
import styles from "../styles/resource-requests.module.css";

const EMPTY_ITEM: RequestItemInput = {
  kind: "MATERIAL",
  label: "",
  quantity: 1,
};

export function RequestFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const editing = Boolean(id);

  const [electionId, setElectionId] = useState("");
  const [form, setForm] = useState({
    title: "",
    description: "",
    priority: "NORMAL" as ResourceRequestPriority,
    neededAt: "",
    electoralZoneId: "",
    pollingPlaceId: "",
    incidentId: "",
  });
  const [items, setItems] = useState<RequestItemInput[]>([EMPTY_ITEM]);
  const [error, setError] = useState<Error>();
  const [saving, setSaving] = useState(false);

  const references = useAsync(
    () => resourceRequestsService.references(electionId || undefined),
    [electionId],
  );
  const existing = useAsync(
    () => (id ? resourceRequestsService.detail(id) : Promise.resolve(undefined)),
    [id],
  );

  useEffect(() => {
    const record = existing.data;
    if (!record) return;
    setElectionId(record.electionId);
    setForm({
      title: record.title,
      description: record.description,
      priority: record.priority,
      neededAt: record.neededAt ? record.neededAt.slice(0, 16) : "",
      electoralZoneId: record.electoralZoneId ?? "",
      pollingPlaceId: record.pollingPlaceId ?? "",
      incidentId: record.incidentId ?? "",
    });
    setItems(
      record.items.map((item) => ({
        kind: item.kind,
        label: item.label,
        description: item.description ?? undefined,
        quantity: item.quantity,
        notes: item.notes ?? undefined,
        assetTypeId: item.assetType?.id,
        fieldTeamId: item.fieldTeam?.id,
        vehicleId: item.vehicle?.id,
      })),
    );
  }, [existing.data]);

  const zones = (references.data?.zones ?? []).filter(
    (zone) => !electionId || zone.electionId === electionId,
  );
  const places = (references.data?.places ?? []).filter(
    (place) => !form.electoralZoneId || place.electoralZoneId === form.electoralZoneId,
  );

  const submit = async () => {
    setSaving(true);
    setError(undefined);
    try {
      const payload = {
        electionId,
        title: form.title,
        description: form.description,
        priority: form.priority,
        neededAt: form.neededAt ? new Date(form.neededAt).toISOString() : undefined,
        electoralZoneId: form.electoralZoneId || undefined,
        pollingPlaceId: form.pollingPlaceId || undefined,
        incidentId: form.incidentId || undefined,
        items,
      };
      const record = id
        ? await resourceRequestsService.update(id, payload)
        : await resourceRequestsService.create(payload);
      navigate(`/resource-requests/${record.id}`);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause
          : new Error("Não foi possível salvar a solicitação."),
      );
    } finally {
      setSaving(false);
    }
  };

  const patchItem = (index: number, next: Partial<RequestItemInput>) =>
    setItems((current) =>
      current.map((item, position) =>
        position === index ? { ...item, ...next } : item,
      ),
    );

  if (editing && existing.loading) return <Loading label="Carregando solicitação…" />;
  if (editing && existing.error)
    return <ErrorState error={existing.error} onRetry={existing.reload} />;
  if (
    editing &&
    existing.data &&
    existing.data.status !== "DRAFT"
  )
    return (
      <section className={styles.page}>
        <EmptyState
          title="Solicitação não editável"
          description={`Somente rascunhos podem ser editados. Status atual: ${
            RESOURCE_REQUEST_STATUS_LABELS[existing.data.status]
          }.`}
          action={
            <LinkButton to={`/resource-requests/${id}`}>
              Ver solicitação
            </LinkButton>
          }
        />
      </section>
    );

  const canSubmit = electionId && form.title.length >= 3 && form.description.length >= 3;

  return (
    <section className={styles.page}>
      <Breadcrumb
        items={[
          { label: "Solicitações de recurso", to: "/resource-requests" },
          { label: editing ? "Editar solicitação" : "Nova solicitação" },
        ]}
      />
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>PEDIDO OPERACIONAL</span>
          <h1>{editing ? "Editar solicitação" : "Nova solicitação"}</h1>
          <p>
            Descreva o contexto, os itens necessários e o prazo. A triagem e a
            aprovação acontecem depois da submissão.
          </p>
        </div>
        <div className={styles.headerActions}>
          <LinkButton secondary to="/resource-requests">
            Cancelar
          </LinkButton>
        </div>
      </header>

      {error && <ErrorState error={error} />}

      <div className={styles.form}>
        <section className={styles.formSection}>
          <h2>Contexto</h2>
          <div className={styles.formGrid}>
            <Field label="Pleito">
              <Select
                value={electionId}
                onChange={(event) => {
                  setElectionId(event.target.value);
                  setForm((current) => ({
                    ...current,
                    electoralZoneId: "",
                    pollingPlaceId: "",
                    incidentId: "",
                  }));
                }}
              >
                <option value="">Selecione</option>
                {(references.data?.elections ?? []).map((election) => (
                  <option key={election.id} value={election.id}>
                    {election.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Zona eleitoral">
              <Select
                value={form.electoralZoneId}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    electoralZoneId: event.target.value,
                    pollingPlaceId: "",
                  }))
                }
                disabled={!electionId}
              >
                <option value="">Não informada</option>
                {zones.map((zone) => (
                  <option key={zone.id} value={zone.id}>
                    {zone.number} · {zone.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Local de votação">
              <Select
                value={form.pollingPlaceId}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    pollingPlaceId: event.target.value,
                  }))
                }
                disabled={!electionId}
              >
                <option value="">Não informado</option>
                {places.map((place) => (
                  <option key={place.id} value={place.id}>
                    {place.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Incidente relacionado">
              <Select
                value={form.incidentId}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    incidentId: event.target.value,
                  }))
                }
                disabled={!electionId}
              >
                <option value="">Nenhum</option>
                {(references.data?.incidents ?? []).map((incident) => (
                  <option key={incident.id} value={incident.id}>
                    {incident.code} · {incident.title}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </section>

        <section className={styles.formSection}>
          <h2>Pedido</h2>
          <div className={styles.formGrid}>
            <Field label="Título">
              <Input
                value={form.title}
                maxLength={200}
                onChange={(event) =>
                  setForm((current) => ({ ...current, title: event.target.value }))
                }
              />
            </Field>
            <Field label="Prioridade">
              <Select
                value={form.priority}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    priority: event.target.value as ResourceRequestPriority,
                  }))
                }
              >
                {RESOURCE_REQUEST_PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>
                    {RESOURCE_REQUEST_PRIORITY_LABELS[priority]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Necessário até">
              <Input
                type="datetime-local"
                value={form.neededAt}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    neededAt: event.target.value,
                  }))
                }
              />
            </Field>
          </div>
          <Field label="Descrição">
            <textarea
              value={form.description}
              maxLength={8000}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
            />
          </Field>
        </section>

        <section className={styles.formSection}>
          <h2>Itens solicitados</h2>
          {items.map((item, index) => (
            <div className={styles.itemRow} key={index}>
              <Field label="Tipo">
                <Select
                  value={item.kind}
                  onChange={(event) =>
                    patchItem(index, {
                      kind: event.target.value as ResourceRequestItemKind,
                      assetTypeId: undefined,
                      fieldTeamId: undefined,
                      vehicleId: undefined,
                    })
                  }
                >
                  {(
                    Object.keys(
                      RESOURCE_REQUEST_ITEM_KIND_LABELS,
                    ) as ResourceRequestItemKind[]
                  ).map((kind) => (
                    <option key={kind} value={kind}>
                      {RESOURCE_REQUEST_ITEM_KIND_LABELS[kind]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Descrição do item">
                <Input
                  value={item.label}
                  maxLength={160}
                  onChange={(event) =>
                    patchItem(index, { label: event.target.value })
                  }
                />
              </Field>
              <Field label="Quantidade">
                <Input
                  type="number"
                  min={1}
                  value={item.quantity}
                  onChange={(event) =>
                    patchItem(index, { quantity: Number(event.target.value) })
                  }
                />
              </Field>
              <Button
                secondary
                onClick={() =>
                  setItems((current) =>
                    current.length === 1
                      ? current
                      : current.filter((_, position) => position !== index),
                  )
                }
                disabled={items.length === 1}
              >
                Remover
              </Button>
              {item.kind === "ASSET_TYPE" && (
                <Field label="Tipo de ativo">
                  <Select
                    value={item.assetTypeId ?? ""}
                    onChange={(event) =>
                      patchItem(index, { assetTypeId: event.target.value })
                    }
                  >
                    <option value="">Selecione</option>
                    {(references.data?.assetTypes ?? []).map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
              {item.kind === "FIELD_TEAM" && (
                <Field label="Equipe de campo">
                  <Select
                    value={item.fieldTeamId ?? ""}
                    onChange={(event) =>
                      patchItem(index, { fieldTeamId: event.target.value })
                    }
                  >
                    <option value="">Selecione</option>
                    {(references.data?.teams ?? []).map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.code} · {team.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
              {item.kind === "VEHICLE" && (
                <Field label="Veículo">
                  <Select
                    value={item.vehicleId ?? ""}
                    onChange={(event) =>
                      patchItem(index, { vehicleId: event.target.value })
                    }
                  >
                    <option value="">Selecione</option>
                    {(references.data?.vehicles ?? []).map((vehicle) => (
                      <option key={vehicle.id} value={vehicle.id}>
                        {vehicle.identification} · {vehicle.plate}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
            </div>
          ))}
          <div className={styles.formActions}>
            <Button
              secondary
              onClick={() => setItems((current) => [...current, EMPTY_ITEM])}
            >
              Adicionar item
            </Button>
          </div>
        </section>

        <section className={styles.formSection}>
          <h2>Revisão</h2>
          <dl className={styles.definitionGrid}>
            <dt>Pleito</dt>
            <dd>
              {(references.data?.elections ?? []).find(
                (election) => election.id === electionId,
              )?.name ?? "Não selecionado"}
            </dd>
            <dt>Itens</dt>
            <dd>{items.length}</dd>
            <dt>Prioridade</dt>
            <dd>{RESOURCE_REQUEST_PRIORITY_LABELS[form.priority]}</dd>
            <dt>Próximo passo</dt>
            <dd>
              O pedido é salvo como rascunho e precisa ser submetido para seguir
              à triagem.
            </dd>
          </dl>
          <div className={styles.formActions} style={{ marginTop: 14 }}>
            <Button onClick={() => void submit()} disabled={saving || !canSubmit}>
              {saving ? "Salvando…" : editing ? "Salvar rascunho" : "Criar rascunho"}
            </Button>
          </div>
        </section>
      </div>
    </section>
  );
}
