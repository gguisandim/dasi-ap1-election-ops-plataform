import { useState } from "react";
import { Button, ErrorState, Field, Input, Select } from "@eops/ui";
import { RESOURCE_REQUEST_ITEM_KIND_LABELS } from "@eops/shared/resource-requests";
import type {
  FulfillmentInput,
  ResourceRequestDetail,
  ResourceRequestItemProgress,
} from "../../types";
import { ProgressBar } from "./RequestBadges";
import styles from "../styles/resource-requests.module.css";

interface Draft {
  requestItemId: string;
  quantity: number;
  assetId: string;
  assetReservationId: string;
  fieldTeamId: string;
  vehicleId: string;
  routeId: string;
  notes: string;
}

function emptyDraft(itemId: string): Draft {
  return {
    requestItemId: itemId,
    quantity: 1,
    assetId: "",
    assetReservationId: "",
    fieldTeamId: "",
    vehicleId: "",
    routeId: "",
    notes: "",
  };
}

export function FulfillmentPanel({
  request,
  canFulfill,
  onAdd,
  onRemove,
}: {
  request: ResourceRequestDetail;
  canFulfill: boolean;
  onAdd: (input: FulfillmentInput) => Promise<void>;
  onRemove: (fulfillmentId: string) => Promise<void>;
}) {
  const pending = request.items.filter((item) => item.remainingQuantity > 0);
  const [draft, setDraft] = useState<Draft | null>(
    pending.length > 0 ? emptyDraft(pending[0].id) : null,
  );
  const [error, setError] = useState<Error>();
  const [saving, setSaving] = useState(false);

  const selectedItem: ResourceRequestItemProgress | undefined = request.items.find(
    (item) => item.id === draft?.requestItemId,
  );

  const submit = async () => {
    if (!draft) return;
    setSaving(true);
    setError(undefined);
    try {
      await onAdd({
        requestItemId: draft.requestItemId,
        quantity: draft.quantity,
        assetId: draft.assetId || undefined,
        assetReservationId: draft.assetReservationId || undefined,
        fieldTeamId: draft.fieldTeamId || undefined,
        vehicleId: draft.vehicleId || undefined,
        routeId: draft.routeId || undefined,
        notes: draft.notes || undefined,
      });
      setDraft(null);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause
          : new Error("Não foi possível registrar o atendimento."),
      );
    } finally {
      setSaving(false);
    }
  };

  const act = async (operation: () => Promise<void>) => {
    setError(undefined);
    try {
      await operation();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause
          : new Error("Não foi possível remover o atendimento."),
      );
    }
  };

  return (
    <section>
      <div className={styles.sectionTitle}>
        <h2>Atendimento</h2>
        <span className={styles.muted}>
          {request.totals.totalFulfilled}/{request.totals.totalRequired} ·{" "}
          {request.totals.satisfiedItems}/{request.totals.totalItems} item(ns)
          satisfeito(s)
        </span>
      </div>

      {error && <ErrorState error={error} />}

      <ul className={styles.cardList}>
        {request.items.map((item) => (
          <li key={item.id} className={styles.itemCard}>
            <div className={styles.itemHeader}>
              <h3>{item.label}</h3>
              <span className={styles.muted}>
                {RESOURCE_REQUEST_ITEM_KIND_LABELS[item.kind]}
              </span>
            </div>
            <p>
              Necessário {item.quantity} · atendido {item.fulfilledQuantity} ·
              pendente {item.remainingQuantity}
            </p>
            <ProgressBar
              percent={item.progressPercent}
              label={`Atendimento de ${item.label}`}
            />
            {item.fulfillments.length > 0 && (
              <ul className={styles.fulfillmentList}>
                {item.fulfillments.map((fulfillment) => (
                  <li key={fulfillment.id}>
                    <span>
                      {fulfillment.quantity} un. · {fulfillment.fulfilledBy.name}
                      {fulfillment.asset ? ` · ${fulfillment.asset.assetTag}` : ""}
                      {fulfillment.fieldTeam ? ` · ${fulfillment.fieldTeam.name}` : ""}
                      {fulfillment.vehicle
                        ? ` · ${fulfillment.vehicle.identification}`
                        : ""}
                      {fulfillment.route ? ` · rota ${fulfillment.route.code}` : ""}
                      {fulfillment.notes ? ` · ${fulfillment.notes}` : ""}
                    </span>
                    {canFulfill && (
                      <Button
                        secondary
                        onClick={() =>
                          void act(() => onRemove(fulfillment.id))
                        }
                      >
                        Remover
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>

      {canFulfill && pending.length > 0 && (
        <div className={styles.commentForm}>
          <div className={styles.formGrid}>
            <Field label="Item">
              <Select
                value={draft?.requestItemId ?? ""}
                onChange={(event) =>
                  setDraft({
                    ...(draft ?? emptyDraft(event.target.value)),
                    requestItemId: event.target.value,
                    quantity: 1,
                  })
                }
              >
                {pending.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label} · pendente {item.remainingQuantity}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Quantidade">
              <Input
                type="number"
                min={1}
                max={selectedItem?.remainingQuantity ?? 1}
                value={draft?.quantity ?? 1}
                onChange={(event) =>
                  setDraft((current) =>
                    current
                      ? { ...current, quantity: Number(event.target.value) }
                      : current,
                  )
                }
              />
            </Field>
          </div>

          {selectedItem?.kind === "ASSET" || selectedItem?.kind === "MATERIAL" ? (
            <Field label="Ativo utilizado (identificador)">
              <Input
                value={draft?.assetId ?? ""}
                placeholder="ID do ativo em inventário"
                onChange={(event) =>
                  setDraft((current) =>
                    current ? { ...current, assetId: event.target.value } : current,
                  )
                }
              />
            </Field>
          ) : null}
          {selectedItem?.kind === "ASSET_TYPE" ? (
            <>
              <Field label="Ativo utilizado (identificador)">
                <Input
                  value={draft?.assetId ?? ""}
                  onChange={(event) =>
                    setDraft((current) =>
                      current ? { ...current, assetId: event.target.value } : current,
                    )
                  }
                />
              </Field>
              <Field label="Reserva de ativo (opcional)">
                <Input
                  value={draft?.assetReservationId ?? ""}
                  onChange={(event) =>
                    setDraft((current) =>
                      current
                        ? { ...current, assetReservationId: event.target.value }
                        : current,
                    )
                  }
                />
              </Field>
            </>
          ) : null}
          {selectedItem?.kind === "FIELD_TEAM" || selectedItem?.kind === "TECH_SUPPORT" ? (
            <Field label="Equipe de campo (identificador)">
              <Input
                value={draft?.fieldTeamId ?? ""}
                onChange={(event) =>
                  setDraft((current) =>
                    current ? { ...current, fieldTeamId: event.target.value } : current,
                  )
                }
              />
            </Field>
          ) : null}
          {selectedItem?.kind === "VEHICLE" || selectedItem?.kind === "TRANSPORT" ? (
            <Field label="Veículo (identificador)">
              <Input
                value={draft?.vehicleId ?? ""}
                onChange={(event) =>
                  setDraft((current) =>
                    current ? { ...current, vehicleId: event.target.value } : current,
                  )
                }
              />
            </Field>
          ) : null}
          {selectedItem?.kind === "TRANSPORT" || selectedItem?.kind === "MATERIAL" ? (
            <Field label="Rota de distribuição (opcional)">
              <Input
                value={draft?.routeId ?? ""}
                onChange={(event) =>
                  setDraft((current) =>
                    current ? { ...current, routeId: event.target.value } : current,
                  )
                }
              />
            </Field>
          ) : null}

          <Field label="Notas">
            <Input
              value={draft?.notes ?? ""}
              onChange={(event) =>
                setDraft((current) =>
                  current ? { ...current, notes: event.target.value } : current,
                )
              }
            />
          </Field>
          <p className={styles.actionHint}>
            O servidor valida a elegibilidade do ativo, a compatibilidade da
            equipe com o pleito e o saldo pendente do item antes de registrar.
          </p>
          <Button onClick={() => void submit()} disabled={saving || !draft}>
            {saving ? "Registrando…" : "Registrar atendimento"}
          </Button>
        </div>
      )}

      {canFulfill && pending.length === 0 && request.items.length > 0 && (
        <p className={styles.muted}>Todos os itens já estão atendidos.</p>
      )}
    </section>
  );
}
