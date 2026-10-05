import { Badge, Breadcrumb, Button, Card, ErrorState, Field, Loading, Select, useAsync } from "@eops/ui";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { AccessNav } from "../components/AccessNav";
import { userService } from "../services/authService";
import { USER_STATUSES, USER_STATUS_LABELS, USER_STATUS_TONES } from "../status";
import type { UserDetailRecord } from "../types";
import type { UserStatus } from "@eops/shared/auth";
import styles from "../styles/access.module.css";

export function UserDetailPage() {
  const { id = "" } = useParams();
  const { user: currentUser, hasPermission } = useAuth();
  const canManage = hasPermission("users.manage");
  const detail = useAsync(() => userService.get(id), [id]);
  const roles = useAsync(userService.roles, []);
  const [roleId, setRoleId] = useState("");
  const [status, setStatus] = useState<UserStatus>("ACTIVE");
  const [error, setError] = useState<unknown>();
  useEffect(() => { if (detail.data) setStatus(detail.data.status); }, [detail.data]);
  async function act(action: () => Promise<UserDetailRecord>) {
    setError(undefined);
    try { detail.setData(await action()); }
    catch (cause) { setError(cause); }
  }
  const current = detail.data;
  const assignedIds = new Set(current?.roles.map((entry) => entry.roleId) ?? []);
  const availableRoles = roles.data?.filter((role) => !assignedIds.has(role.id)) ?? [];
  const isSelf = current?.id === currentUser?.id;
  const selfDeactivationBlocked = isSelf && status !== "ACTIVE";
  return (
    <section className={styles.page}>
      <AccessNav />
      <Breadcrumb items={[{ label: "Usuários", to: "/users" }, { label: current?.name ?? "Detalhes" }]} />
      {detail.loading && <Loading />}
      {detail.error && <ErrorState error={detail.error} onRetry={detail.reload} />}
      {error !== undefined && <ErrorState error={error} />}
      {current && (
        <>
          <header className={styles.header}>
            <div><span>USUÁRIO</span><h1>{current.name}</h1><p className={styles.muted}>{current.email}</p></div>
            <Badge tone={USER_STATUS_TONES[current.status]}>{USER_STATUS_LABELS[current.status]}</Badge>
          </header>
          <div className={styles.detailGrid}>
            <div className={styles.detailColumn}>
              <Card>
                <div className={styles.sectionHeading}><h2>Perfis vinculados</h2><Badge>{current.roles.length}</Badge></div>
                {current.roles.length ? (
                  <ul className={styles.list}>
                    {current.roles.map(({ role }) => (
                      <li key={role.id}>
                        <div><Link to={`/roles/${role.id}`}>{role.name}</Link><small>{role.key}{!role.active && " · inativo"}</small></div>
                        {canManage && <Button secondary disabled={isSelf && (current.permissionsByRole[role.id] ?? []).includes("users.manage")} onClick={() => void act(() => userService.removeRole(id, role.id))}>Remover</Button>}
                      </li>
                    ))}
                  </ul>
                ) : <p className={styles.muted}>Este usuário não possui perfis vinculados.</p>}
                {canManage && (
                  <div className={styles.inlineForm}>
                    <Field label="Adicionar perfil"><Select value={roleId} onChange={(event) => setRoleId(event.target.value)}><option value="">Selecione um perfil</option>{availableRoles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</Select></Field>
                    <Button disabled={!roleId} onClick={() => void act(async () => { const result = await userService.addRoles(id, [roleId]); setRoleId(""); return result; })}>Adicionar</Button>
                  </div>
                )}
              </Card>
              <Card>
                <h2>Permissões herdadas por perfil</h2>
                {current.roles.length ? current.roles.map(({ role }) => (
                  <div key={role.id} className={styles.permissionBlock}>
                    <strong>{role.name}</strong>
                    <div className={styles.chips}>{(current.permissionsByRole[role.id] ?? []).map((key) => <Badge key={key} tone={role.active ? "neutral" : "warning"}>{key}</Badge>)}</div>
                  </div>
                )) : <p className={styles.muted}>Sem permissões herdadas.</p>}
              </Card>
            </div>
            <div className={styles.detailColumn}>
              <Card>
                <h2>Permissões efetivas</h2>
                <p className={styles.muted}>União ordenada das permissões dos perfis ativos. Derivada, não persistida.</p>
                <div className={styles.chips}>{current.effectivePermissions.length ? current.effectivePermissions.map((key) => <Badge key={key} tone="success">{key}</Badge>) : <span className={styles.muted}>Nenhuma permissão efetiva.</span>}</div>
              </Card>
              {canManage && (
                <Card>
                  <h2>Situação da conta</h2>
                  <Field label="Status"><Select value={status} onChange={(event) => setStatus(event.target.value as UserStatus)} disabled={!canManage}>{USER_STATUSES.map((value) => <option key={value} value={value}>{USER_STATUS_LABELS[value]}</option>)}</Select></Field>
                  {selfDeactivationBlocked && <p className={styles.inlineError}>Você não pode alterar o próprio status para um valor diferente de Ativo.</p>}
                  <Button disabled={status === current.status || selfDeactivationBlocked} onClick={() => void act(() => userService.updateStatus(id, status))}>Aplicar situação</Button>
                </Card>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
