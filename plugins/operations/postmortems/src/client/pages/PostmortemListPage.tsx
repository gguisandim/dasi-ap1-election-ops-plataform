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
  POSTMORTEM_STATUSES,
  POSTMORTEM_STATUS_LABELS,
  type PostmortemStatus,
} from "@eops/shared/postmortems";
import { Link } from "react-router-dom";
import { PostmortemStatusPill, SeverityBadge } from "../components/PostmortemBadges";
import { postmortemsService } from "../services/postmortemsService";
import styles from "../styles/postmortems.module.css";

export function PostmortemListPage() {
  const [query, setQuery] = useState({
    page: 1,
    pageSize: 20,
    search: "",
    status: "" as PostmortemStatus | "",
    electionId: "",
  });
  const { data, error, loading, reload } = useAsync(
    () =>
      postmortemsService.list({
        page: query.page,
        pageSize: query.pageSize,
        search: query.search || undefined,
        status: query.status || undefined,
        electionId: query.electionId || undefined,
      }),
    [JSON.stringify(query)],
  );
  const references = useAsync(postmortemsService.references, []);
  const patch = (next: Partial<typeof query>) =>
    setQuery((current) => ({ ...current, ...next, page: 1 }));

  return (
    <section className={styles.page}>
      <Breadcrumb
        items={[
          { label: "Postmortem", to: "/postmortems/dashboard" },
          { label: "Todas as análises" },
        ]}
      />
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>REGISTRO</span>
          <h1>Análises pós-incidente</h1>
          <p>
            Cada análise está vinculada a um incidente primário e não altera o
            incidente original.
          </p>
        </div>
        <div className={styles.headerActions}>
          <LinkButton secondary to="/postmortems/dashboard">
            Painel
          </LinkButton>
          <LinkButton to="/postmortems/new">Nova análise</LinkButton>
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
              patch({ status: event.target.value as PostmortemStatus | "" })
            }
          >
            <option value="">Todos os status</option>
            {POSTMORTEM_STATUSES.map((status) => (
              <option key={status} value={status}>
                {POSTMORTEM_STATUS_LABELS[status]}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Pleito"
            value={query.electionId}
            onChange={(event) => patch({ electionId: event.target.value })}
          >
            <option value="">Todos os pleitos</option>
            {(references.data?.elections ?? []).map((election) => (
              <option key={election.id} value={election.id}>
                {election.name}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      {loading && <Loading label="Carregando análises…" />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {data?.items.length === 0 && (
        <EmptyState
          title="Nenhuma análise encontrada"
          description="Crie um postmortem para um incidente já resolvido."
          action={<LinkButton to="/postmortems/new">Nova análise</LinkButton>}
        />
      )}

      {data && data.items.length > 0 && (
        <>
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Título</th>
                  <th>Incidente</th>
                  <th>Severidade</th>
                  <th>Status</th>
                  <th className={styles.numeric}>Causas</th>
                  <th className={styles.numeric}>Lições</th>
                  <th className={styles.numeric}>Ações</th>
                  <th>Responsável</th>
                  <th>Atualizado</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <Link to={`/postmortems/${item.id}`}>{item.code}</Link>
                    </td>
                    <td>
                      <strong>{item.title}</strong>
                    </td>
                    <td>
                      <Link to={`/incidents/${item.primaryIncident.id}`}>
                        {item.primaryIncident.code}
                      </Link>
                      <small>{item.primaryIncident.title}</small>
                    </td>
                    <td>
                      <SeverityBadge severity={item.primaryIncident.severity} />
                    </td>
                    <td>
                      <PostmortemStatusPill status={item.status} />
                    </td>
                    <td className={styles.numeric}>{item._count.causes}</td>
                    <td className={styles.numeric}>{item._count.lessons}</td>
                    <td className={styles.numeric}>{item._count.actions}</td>
                    <td>{item.owner?.name ?? "—"}</td>
                    <td>{formatDateTime(item.updatedAt)}</td>
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
