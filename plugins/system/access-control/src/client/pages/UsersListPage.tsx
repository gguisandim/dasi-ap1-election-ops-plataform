import { Badge, Button, Card, EmptyState, ErrorState, Field, Input, Loading, Select, useAsync } from "@eops/ui";
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { AccessNav } from "../components/AccessNav";
import { userService } from "../services/authService";
import { USER_STATUS_LABELS, USER_STATUS_TONES } from "../status";
import styles from "../styles/access.module.css";

export function UsersListPage() {
  const users = useAsync(userService.list, []);
  const roles = useAsync(userService.roles, []);
  const { hasPermission } = useAuth();
  const canManage = hasPermission("users.manage");
  const [form, setForm] = useState({ name: "", email: "", password: "", roleId: "" });
  const [error, setError] = useState<unknown>();
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(undefined);
    try {
      await userService.create({ name: form.name, email: form.email, password: form.password, roleIds: form.roleId ? [form.roleId] : [] });
      setForm({ name: "", email: "", password: "", roleId: "" });
      users.reload();
    } catch (cause) { setError(cause); }
  }
  return (
    <section className={styles.page}>
      <AccessNav />
      <header className={styles.header}><div><span>SISTEMA</span><h1>Usuários e acessos</h1><p>Contas, perfis vinculados e situação de acesso.</p></div></header>
      {error !== undefined && <ErrorState error={error} />}
      <div className={styles.layout}>
        {canManage && (
          <Card>
            <h2>Novo usuário</h2>
            <form className={styles.form} onSubmit={(event) => void submit(event)}>
              <Field label="Nome"><Input required value={form.name} onChange={(event) => setForm((old) => ({ ...old, name: event.target.value }))} /></Field>
              <Field label="E-mail"><Input required type="email" value={form.email} onChange={(event) => setForm((old) => ({ ...old, email: event.target.value }))} /></Field>
              <Field label="Senha inicial"><Input required type="password" minLength={10} value={form.password} onChange={(event) => setForm((old) => ({ ...old, password: event.target.value }))} /></Field>
              <Field label="Perfil"><Select value={form.roleId} onChange={(event) => setForm((old) => ({ ...old, roleId: event.target.value }))}><option value="">Sem perfil</option>{roles.data?.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</Select></Field>
              <Button type="submit">Criar usuário</Button>
            </form>
          </Card>
        )}
        <Card>
          <h2>Usuários</h2>
          {users.loading && <Loading />}
          {users.error && <ErrorState error={users.error} onRetry={users.reload} />}
          {users.data && (users.data.length ? (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead><tr><th>Usuário</th><th>Situação</th><th>Perfis</th></tr></thead>
                <tbody>
                  {users.data.map((user) => (
                    <tr key={user.id}>
                      <td><Link to={`/users/${user.id}`}>{user.name}</Link><small>{user.email}</small></td>
                      <td><Badge tone={USER_STATUS_TONES[user.status]}>{USER_STATUS_LABELS[user.status]}</Badge></td>
                      <td><div className={styles.chips}>{user.roles.length ? user.roles.map(({ role }) => <Badge key={role.id} tone={role.active ? "neutral" : "warning"}>{role.name}</Badge>) : <span className={styles.muted}>Sem perfil</span>}</div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <EmptyState title="Nenhum usuário" description="Crie o primeiro usuário para conceder acesso à plataforma." />)}
        </Card>
      </div>
    </section>
  );
}
