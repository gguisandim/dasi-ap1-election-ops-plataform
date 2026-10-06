import { useState } from "react";
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
  RESOURCE_REQUEST_STATUSES,
  RESOURCE_REQUEST_STATUS_LABELS,
  type ResourceRequestItemKind,
  type ResourceRequestStatus,
} from "@eops/shared/resource-requests";
import {
  PriorityBadge,
  ProgressBar,
  StatusBadge,
  UrgencyBadge,
} from "../components/RequestBadges";
import { resourceRequestsService } from "../services/resourceRequestsService";
import { Link } from "react-router-dom";
import styles from "../styles/resource-requests.module.css";

export function RequestListPage() {
  const [query, setQuery] = useState({
    page: 1,
    pageSize: 20,
    search: "",
    status: "" as ResourceRequestStatus | "",
    itemKind: "" as ResourceRequestItemKind | "",
    electionId: "",
  });
  const { data, error, loading, reload } = useAsync(
    () =>
      resourceRequestsService.list({
        page: query.page,
        pageSize: query.pageSize,
        search: query.search || undefined,
        status: query.status || undefined,
        itemKind: query.itemKind || undefined,
        electionId: query.electionId || undefined,
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
          { label: "Todas as solicitações" },
        ]}
      />
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>HISTÓRICO</span>
          <h1>Todas as solicitações</h1>
          <p>
            Inclui rascunhos, rejeitadas, canceladas e atendidas — o registro
            completo do pedido operacional.
          </p>
        </div>
        <div className={styles.headerActions}>
          <LinkButton secondary to="/resource-requests/queue">
            Fila operacional
          </LinkButton>
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
        </div>
      </Card>

      {loading && <Loading label="Carregando solicitações…" />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {data?.items.length === 0 && (
        <EmptyState
          title="Nenhuma solicitação encontrada"
          description="Ajuste os filtros ou registre uma nova solicitação operacional."
        />
      )}

      {data && data.items.length > 0 && (
        <>
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Solicitação</th>
                  <th>Prioridade</th>
                  <th>Status</th>
                  <th>Urgência</th>
                  <th>Solicitante</th>
                  <th>Responsável</th>
                  <th>Necessário até</th>
                  <th>Atendimento</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <Link to={`/resource-requests/${item.id}`}>{item.code}</Link>
                    </td>
                    <td>
                      <strong>{item.title}</strong>
                      <small>
                        {item.pollingPlace?.name ??
                          item.electoralZone?.name ??
                          "Sem local"}
                      </small>
                    </td>
                    <td>
                      <PriorityBadge priority={item.priority} />
                    </td>
                    <td>
                      <StatusBadge status={item.status} />
                    </td>
                    <td>
                      <UrgencyBadge urgency={item.urgency} />
                    </td>
                    <td>{item.requestedBy.name}</td>
                    <td>{item.owner?.name ?? "—"}</td>
                    <td>
                      {item.neededAt ? formatDateTime(item.neededAt) : "—"}
                    </td>
                    <td>
                      {item.totals.totalFulfilled}/{item.totals.totalRequired}
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
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
