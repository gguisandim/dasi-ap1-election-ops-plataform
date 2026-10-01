import { useState } from "react";
import { useParams } from "react-router-dom";
import {
  Button,
  Card,
  ErrorState,
  Field,
  Input,
  LinkButton,
  Loading,
  Pagination,
  Select,
  useAsync,
} from "@eops/ui";
import {
  COMMUNICATION_AUDIENCE_LABELS,
  COMMUNICATION_DELIVERY_LABELS,
  COMMUNICATION_DELIVERY_STATUSES,
  type CommunicationDeliveryStatus,
} from "@eops/shared/communications";
import { MetricGrid, MetricBar, MetricBarLegend } from "../components/MetricBar";
import { RecipientTable } from "../components/RecipientTable";
import {
  communicationService,
  type RecipientFilters,
} from "../services/communicationService";
import { useMutation } from "../hooks/useCommunications";
import styles from "../styles/communications.module.css";

const EMPTY_FILTERS: RecipientFilters = { page: 1, pageSize: 25 };

/**
 * Acompanhamento de leitura: mostra quem recebeu, quem leu e quem confirmou,
 * e permite que a coordenação registre leitura/confirmação em nome de um
 * destinatário sem acesso à plataforma.
 */
export function CommunicationTrackingPage() {
  const { id } = useParams<{ id: string }>();
  const [filters, setFilters] = useState<RecipientFilters>(EMPTY_FILTERS);
  const [busyId, setBusyId] = useState<string>();
  const [feedback, setFeedback] = useState<string>();

  const communication = useAsync(
    () => (id ? communicationService.get(id) : Promise.resolve(undefined)),
    [id ?? ""],
  );

  const recipients = useAsync(
    () =>
      id
        ? communicationService.recipients(id, filters)
        : Promise.resolve(undefined),
    [id ?? "", JSON.stringify(filters)],
  );

  const action = useMutation(
    async (operation: () => Promise<unknown>) => operation(),
    () => {
      communication.reload();
      recipients.reload();
    },
  );

  const run = (recipientId: string, operation: () => Promise<unknown>, message: string) => {
    setBusyId(recipientId);
    setFeedback(undefined);
    void action.run(operation).then((result) => {
      setBusyId(undefined);
      if (result !== undefined) setFeedback(message);
    });
  };

  const sync = useMutation(() =>
    id ? communicationService.syncRecipients(id) : Promise.resolve(undefined),
  );

  if (communication.loading) return <Loading label="Carregando comunicado…" />;
  if (communication.error) {
    return <ErrorState error={communication.error} onRetry={communication.reload} />;
  }
  const data = communication.data;
  if (!data || !id) return <ErrorState error={new Error("Comunicado não encontrado.")} />;

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>ACOMPANHAMENTO {data.code}</span>
          <h1>{data.title}</h1>
          <p>
            {data.recipientCount} destinatário(s) · {data.audiences.length} regra(s) de
            direcionamento.
          </p>
        </div>
        <div className={styles.headerActions}>
          <Button
            disabled={sync.pending}
            onClick={() => {
              void sync.run().then(() => {
                communication.reload();
                recipients.reload();
              });
            }}
          >
            {sync.pending ? "Recalculando…" : "Recalcular destinatários"}
          </Button>
          <LinkButton to={`/communications/messages/${data.id}`} secondary>
            Ver comunicado
          </LinkButton>
        </div>
      </header>

      {sync.error && <ErrorState error={sync.error} />}
      {action.error && <ErrorState error={action.error} />}
      {feedback && <p className={styles.successText}>{feedback}</p>}

      {data.metrics && (
        <Card>
          <h2>Indicadores</h2>
          <MetricGrid metrics={data.metrics} />
          <MetricBar metrics={data.metrics} />
          <MetricBarLegend />
        </Card>
      )}

      <div className={styles.filters}>
        <Field label="Busca">
          <Input
            placeholder="Nome, e-mail, função ou origem"
            value={filters.search ?? ""}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                search: event.target.value || undefined,
                page: 1,
              }))
            }
          />
        </Field>
        <Field label="Estado">
          <Select
            value={filters.deliveryStatus ?? ""}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                deliveryStatus:
                  (event.target.value as CommunicationDeliveryStatus) || undefined,
                page: 1,
              }))
            }
          >
            <option value="">Todos</option>
            {COMMUNICATION_DELIVERY_STATUSES.map((status) => (
              <option key={status} value={status}>
                {COMMUNICATION_DELIVERY_LABELS[status]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Origem">
          <Select
            value={filters.audienceId ?? ""}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                audienceId: event.target.value || undefined,
                page: 1,
              }))
            }
          >
            <option value="">Todas as regras</option>
            {data.audiences.map((audience, index) => (
              <option key={audience.id} value={audience.id}>
                {index + 1}. {COMMUNICATION_AUDIENCE_LABELS[audience.type]}
              </option>
            ))}
          </Select>
        </Field>
        <div className={styles.filterActions}>
          <Button type="button" onClick={() => setFilters(EMPTY_FILTERS)}>
            Limpar filtros
          </Button>
        </div>
      </div>

      {recipients.loading && <Loading label="Carregando destinatários…" />}
      {recipients.error && (
        <ErrorState error={recipients.error} onRetry={recipients.reload} />
      )}

      {recipients.data && recipients.data.items.length === 0 && (
        <p className={styles.mutedText}>
          Nenhum destinatário corresponde aos filtros atuais.
        </p>
      )}

      {recipients.data && recipients.data.items.length > 0 && (
        <>
          <RecipientTable
            recipients={recipients.data.items}
            busyId={busyId}
            onMarkRead={(recipient) =>
              run(
                recipient.id,
                () => communicationService.markRead(id, recipient.id),
                `Leitura de ${recipient.name} registrada.`,
              )
            }
            onConfirm={(recipient) =>
              run(
                recipient.id,
                () => communicationService.confirm(id, recipient.id),
                `Confirmação de ${recipient.name} registrada.`,
              )
            }
          />
          <Pagination
            page={recipients.data.page}
            totalPages={recipients.data.totalPages}
            onChange={(page) => setFilters((current) => ({ ...current, page }))}
          />
        </>
      )}
    </section>
  );
}
