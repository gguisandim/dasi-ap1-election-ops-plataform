import { useState } from "react";
import { ErrorState, Input, Loading, Pagination, Select, useAsync } from "@eops/ui";
import { apiClient } from "@eops/api-client";
import { formatDateTime, type Paginated } from "@eops/shared";
import styles from "../styles/audit.module.css";

const actions = ["CREATE", "UPDATE", "DELETE", "ASSIGN", "STATUS_CHANGE", "LOGIN", "LOGOUT"] as const;
interface AuditEvent { id: string; action: string; entityType: string; entityId: string | null; oldData: unknown; newData: unknown; metadata: unknown; createdAt: string; actor: { name: string; email: string } | null; }
export function AuditListPage() {
  const [query, setQuery] = useState({ action: "", entityType: "", entityId: "", from: "", to: "", page: 1, pageSize: 30 });
  const { data, loading, error, reload } = useAsync(() => apiClient.get<Paginated<AuditEvent>>("/audit", { query }), [JSON.stringify(query)]);
  const set = (key: string, value: string | number) => setQuery((current) => ({ ...current, [key]: value, page: key === "page" ? Number(value) : 1 }));
  return <section className={styles.page}><header><span>SISTEMA</span><h1>Auditoria</h1><p>Registro persistente das ações relevantes da plataforma.</p></header><div className={styles.filters}><Select aria-label="Ação" value={query.action} onChange={(event) => set("action", event.target.value)}><option value="">Todas as ações</option>{actions.map((action) => <option key={action}>{action}</option>)}</Select><Input aria-label="Tipo de recurso" placeholder="Tipo de recurso" value={query.entityType} onChange={(event) => set("entityType", event.target.value)} /><Input aria-label="Recurso" placeholder="ID do recurso" value={query.entityId} onChange={(event) => set("entityId", event.target.value)} /><Input aria-label="Data inicial" type="date" value={query.from} onChange={(event) => set("from", event.target.value)} /><Input aria-label="Data final" type="date" value={query.to} onChange={(event) => set("to", event.target.value)} /></div>{loading && <Loading />}{error && <ErrorState error={error} onRetry={reload} />}{data && <><div className={styles.table}><table><thead><tr><th>Data</th><th>Usuário</th><th>Ação</th><th>Recurso</th><th>ID</th><th>Alteração</th></tr></thead><tbody>{data.items.map((event) => <tr key={event.id}><td>{formatDateTime(event.createdAt)}</td><td>{event.actor?.name ?? "Sistema"}</td><td>{event.action}</td><td>{event.entityType}</td><td>{event.entityId ?? "—"}</td><td><code>{event.newData ? JSON.stringify(event.newData) : event.metadata ? JSON.stringify(event.metadata) : "—"}</code></td></tr>)}</tbody></table></div><Pagination page={data.page} totalPages={data.totalPages} onChange={(page) => set("page", page)} /></>}</section>;
}
