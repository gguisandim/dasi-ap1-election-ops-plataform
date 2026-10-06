import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Breadcrumb,
  Card,
  EmptyState,
  ErrorState,
  Input,
  LinkButton,
  Loading,
  Pagination,
  Select,
  useAsync,
} from "@eops/ui";
import { formatDateTime } from "@eops/shared/format";
import {
  RESOURCE_REQUEST_ITEM_KIND_LABELS,
  RESOURCE_REQUEST_PRIORITIES,
  RESOURCE_REQUEST_STATUSES,
  RESOURCE_REQUEST_STATUS_LABELS,
  type ResourceRequestItemKind,
  type ResourceRequestPriority,
  type ResourceRequestStatus,
} from "@eops/shared/resource-requests";
import {
  PriorityBadge,
  ProgressBar,
  StatusBadge,
  UrgencyBadge,
} from "../components/RequestBadges";
import { resourceRequestsService } from "../services/resourceRequestsService";
import styles from "../styles/resource-requests.module.css";

export function RequestQueuePage() {
  const [query, setQuery] = useState({
    page: 1,
    pageSize: 20,
    search: "",
    status: "" as ResourceRequestStatus | "",
    priority: "" as ResourceRequestPriority | "",
    itemKind: "" as ResourceRequestItemKind | "",
    electionId: "",
    overdue: false,
  });
  const { data, error, loading, reload } = useAsync(
    () =>
      resourceRequestsService.queue({
        page: query.page,
        pageSize: query.pageSize,
        status: query.status || undefined,
        priority: query.priority || undefined,
        itemKind: query.itemKind || undefined,
        search: query.search || undefined,
        electionId: query.electionId || undefined,
        overdue: query.overdue || undefined,
      }),
    [JSON.stringify(query)],
  );
  const elections = useAsync(resourceRequestsService.elections, []);

  const patch = (next: Partial<typeof query>) =>
    setQuery((current) => ({ ...current, ...next, page: 1 }));

  return (
    <section className={styles.page}>
      <Breadcrumb
        items={[
          { label: "Solicitações de recurso", to: "/resource-requests" },
          { label: "Fila operacional" },
        ]}
      />
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>PRIORIZAÇÃO</span>
          <h1>Fila operacional</h1>
          <p>
            Ordem por urgência, prioridade, prazo necessário e idade da
            solicitação. Somente pedidos abertos permanecem aqui.
          </p>
        </div>
        <div className={styles.headerActions}>
          <LinkButton to="/resource-requests/new">Nova solicitação</LinkButton>
        </div>
      </header>

      <Card>
        <div className={styles.filters}>
          <Input
            aria-label="Buscar"
            placeholder="Buscar por código ou título"
            value={query.search}
            onChange={(event) => patch({ search: event.target.value })}
          />
          <Select
            aria-label="Status"
            value={query.status}
            onChange={(event) =>
              patch({ status: event.target.value as ResourceRequestStatus | "" })
            }
          >
            <option value="">Todos os status</option>
            {RESOURCE_REQUEST_STATUSES.map((status) => (
              <option key={status} value={status}>
                {RESOURCE_REQUEST_STATUS_LABELS[status]}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Prioridade"
            value={query.priority}
            onChange={(event) =>
              patch({
                priority: event.target.value as ResourceRequestPriority | "",
              })
            }
          >
            <option value="">Todas as prioridades</option>
            {RESOURCE_REQUEST_PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {priority}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Tipo de item"
            value={query.itemKind}
            onChange={(event) =>
              patch({ itemKind: event.target.value as ResourceRequestItemKind | "" })
            }
          >
            <option value="">Todos os tipos de item</option>
            {(
              Object.keys(RESOURCE_REQUEST_ITEM_KIND_LABELS) as ResourceRequestItemKind[]
            ).map((kind) => (
              <option key={kind} value={kind}>
                {RESOURCE_REQUEST_ITEM_KIND_LABELS[kind]}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Pleito"
            value={query.electionId}
            onChange={(event) => patch({ electionId: event.target.value })}
          >
            <option value="">Todos os pleitos</option>
            {(elections.data ?? []).map((election) => (
              <option key={election.id} value={election.id}>
                {election.name}
              </option>
            ))}
          </Select>
          <label className={styles.queueTags}>
            <input
              type="checkbox"
              checked={query.overdue}
              onChange={(event) => patch({ overdue: event.target.checked })}
            />
            Somente vencidas
          </label>
        </div>
      </Card>

      {loading && <Loading label="Priorizando fila…" />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {data?.items.length === 0 && (
        <EmptyState
          title="Fila vazia"
          description="Nenhuma solicitação corresponde aos filtros aplicados."
          action={<LinkButton to="/resource-requests/new">Nova solicitação</LinkButton>}
        />
      )}

      {data && data.items.length > 0 && (
        <>
          <ol className={styles.queue}>
            {data.items.map((item, index) => (
                <li key={item.id} className={styles.queueItem}>
                  <span className={styles.queueRank}>
                    {(data.page - 1) * data.pageSize + index + 1}
                  </span>
                  <div className={styles.queueMain}>
                    <div className={styles.queueTags}>
                      <PriorityBadge priority={item.priority} />
                      <StatusBadge status={item.status} />
                      <UrgencyBadge urgency={item.urgency} />
                    </div>
                    <Link to={`/resource-requests/${item.id}`}>
                      {item.code} · {item.title}
                    </Link>
                    <p>
                      {item.pollingPlace?.name ??
                        item.electoralZone?.name ??
                        "Sem local informado"}{" "}
                      · {item.requestedBy.name}
                    </p>
                    <ProgressBar
                      percent={
                        item.totals.totalRequired === 0
                          ? 0
                          : Math.round(
                              (item.totals.totalFulfilled /
                                item.totals.totalRequired) *
                                100,
                            )
                      }
                      label={`Atendimento de ${item.code}`}
                    />
                  </div>
                  <div className={styles.queueMeta}>
                    <strong>
                      {item.owner?.name ?? "Sem responsável"}
                    </strong>
                    <span>
                      {item.totals.totalFulfilled}/{item.totals.totalRequired}{" "}
                      atendido(s)
                    </span>
                    <time>
                      {item.neededAt
                        ? `Necessário até ${formatDateTime(item.neededAt)}`
                        : "Sem prazo definido"}
                    </time>
                  </div>
                </li>
              ))}
          </ol>
          <Pagination
            page={data.page}
            totalPages={data.totalPages}
            onChange={(page) => setQuery((current) => ({ ...current, page }))}
          />
        </>
      )}
    </section>
  );
}
