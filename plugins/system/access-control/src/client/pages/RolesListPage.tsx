import { Badge, Button, Card, EmptyState, ErrorState, Field, Input, Loading, useAsync } from "@eops/ui";
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { AccessNav } from "../components/AccessNav";
import { PermissionPicker } from "../components/PermissionPicker";
import { rolesService } from "../services/rolesService";
import styles from "../styles/access.module.css";

export function RolesListPage() {
  const roles = useAsync(rolesService.list, []);
  const catalog = useAsync(rolesService.catalog, []);
  const { hasPermission } = useAuth();
  const canManage = hasPermission("roles.manage");
  const [form, setForm] = useState({ name: "", description: "", key: "" });
  const [permissionKeys, setPermissionKeys] = useState<string[]>([]);
  const [error, setError] = useState<unknown>();
  function toggle(key: string) { setPermissionKeys((old) => old.includes(key) ? old.filter((value) => value !== key) : [...old, key]); }
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(undefined);
    try {
      await rolesService.create({ name: form.name, description: form.description || undefined, key: form.key || undefined, permissionKeys });
      setForm({ name: "", description: "", key: "" });
      setPermissionKeys([]);
      roles.reload();
    } catch (cause) { setError(cause); }
  }
  return (
    <section className={styles.page}>
      <AccessNav />
      <header className={styles.header}><div><span>SISTEMA</span><h1>Perfis e permissões</h1><p>Origem, estado e conjunto de permissões de cada perfil.</p></div></header>
      {error !== undefined && <ErrorState error={error} />}
      <div className={styles.layout}>
        {canManage && (
          <Card>
            <h2>Novo perfil</h2>
            <form className={styles.form} onSubmit={(event) => void submit(event)}>
              <Field label="Nome"><Input required value={form.name} onChange={(event) => setForm((old) => ({ ...old, name: event.target.value }))} /></Field>
              <Field label="Descrição"><Input value={form.description} onChange={(event) => setForm((old) => ({ ...old, description: event.target.value }))} /></Field>
              <Field label="Chave (opcional)"><Input value={form.key} placeholder="Derivada do nome quando vazia" onChange={(event) => setForm((old) => ({ ...old, key: event.target.value }))} /></Field>
              {catalog.loading && <Loading label="Carregando catálogo…" />}
              {catalog.error && <ErrorState error={catalog.error} onRetry={catalog.reload} />}
              {catalog.data && <PermissionPicker groups={catalog.data} selected={permissionKeys} onToggle={toggle} />}
              <Button type="submit" disabled={!form.name.trim()}>Criar perfil</Button>
            </form>
          </Card>
        )}
        <Card>
          <h2>Perfis</h2>
          {roles.loading && <Loading />}
          {roles.error && <ErrorState error={roles.error} onRetry={roles.reload} />}
          {roles.data && (roles.data.length ? (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead><tr><th>Perfil</th><th>Chave</th><th>Origem</th><th>Estado</th></tr></thead>
                <tbody>
                  {roles.data.map((role) => (
                    <tr key={role.id}>
                      <td><Link to={`/roles/${role.id}`}>{role.name}</Link>{role.description && <small>{role.description}</small>}</td>
                      <td className={styles.mono}>{role.key}</td>
                      <td><Badge tone={role.system ? "warning" : "neutral"}>{role.system ? "Sistema" : "Personalizado"}</Badge></td>
                      <td><Badge tone={role.active ? "success" : "danger"}>{role.active ? "Ativo" : "Inativo"}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <EmptyState title="Nenhum perfil" description="Crie um perfil para agrupar permissões." />)}
        </Card>
      </div>
    </section>
  );
}
