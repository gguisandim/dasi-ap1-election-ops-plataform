import { Badge, Card, EmptyState, ErrorState, Loading, useAsync } from "@eops/ui";
import { Link } from "react-router-dom";
import { AccessNav } from "../components/AccessNav";
import { rolesService } from "../services/rolesService";
import styles from "../styles/access.module.css";

export function RoleMatrixPage() {
  const roles = useAsync(rolesService.list, []);
  const catalog = useAsync(rolesService.catalog, []);
  const groups = catalog.data ?? [];
  return (
    <section className={styles.page}>
      <AccessNav />
      <header className={styles.header}><div><span>GOVERNANÇA</span><h1>Matriz de perfis e permissões</h1><p>Quais permissões cada perfil concede, a partir dos dados reais.</p></div></header>
      <Card>
        {roles.loading && <Loading />}
        {catalog.loading && <Loading label="Carregando catálogo…" />}
        {(roles.error || catalog.error) && <ErrorState error={roles.error ?? catalog.error} onRetry={() => { roles.reload(); catalog.reload(); }} />}
        {roles.data && catalog.data && (roles.data.length && groups.length ? (
          <div className={styles.tableWrap}>
            <table className={`${styles.table} ${styles.matrix}`}>
              <thead>
                <tr><th rowSpan={2}>Perfil</th>{groups.map((group) => <th key={group.domain} colSpan={group.permissions.length}>{group.label}</th>)}</tr>
                <tr>{groups.flatMap((group) => group.permissions.map((permission) => <th key={permission.key} className={styles.matrixPermission}><span>{permission.action}</span></th>))}</tr>
              </thead>
              <tbody>
                {roles.data.map((role) => {
                  const keys = new Set(role.permissions.map((entry) => entry.permission.key));
                  return (
                    <tr key={role.id}>
                      <th scope="row" className={styles.matrixRole}><Link to={`/roles/${role.id}`}>{role.name}</Link><Badge tone={role.active ? "success" : "danger"}>{role.active ? "Ativo" : "Inativo"}</Badge></th>
                      {groups.flatMap((group) => group.permissions.map((permission) => (
                        <td key={`${role.id}-${permission.key}`} className={keys.has(permission.key) ? styles.matrixOn : styles.matrixOff} title={permission.key}>{keys.has(permission.key) ? "✓" : "·"}</td>
                      )))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <EmptyState title="Sem dados para a matriz" description="Cadastre perfis e verifique o catálogo de permissões." />)}
      </Card>
    </section>
  );
}
