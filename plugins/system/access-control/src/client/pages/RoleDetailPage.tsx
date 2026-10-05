import { Badge, Breadcrumb, Button, Card, ErrorState, Field, Input, Loading, useAsync } from "@eops/ui";
import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { AccessNav } from "../components/AccessNav";
import { PermissionPicker } from "../components/PermissionPicker";
import { rolesService } from "../services/rolesService";
import type { RoleRecord } from "../types";
import styles from "../styles/access.module.css";

export function RoleDetailPage() {
  const { id = "" } = useParams();
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const canManage = hasPermission("roles.manage");
  const role = useAsync(() => rolesService.role(id), [id]);
  const catalog = useAsync(rolesService.catalog, []);
  const [form, setForm] = useState({ name: "", description: "" });
  const [permissionKeys, setPermissionKeys] = useState<string[]>([]);
  const [error, setError] = useState<unknown>();
  useEffect(() => {
    if (role.data) { setForm({ name: role.data.name, description: role.data.description ?? "" }); setPermissionKeys(role.data.permissions.map((entry) => entry.permission.key)); }
  }, [role.data]);
  function toggle(key: string) { setPermissionKeys((old) => old.includes(key) ? old.filter((value) => value !== key) : [...old, key]); }
  async function act(action: () => Promise<RoleRecord>) {
    setError(undefined);
    try { role.setData(await action()); }
    catch (cause) { setError(cause); }
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    await act(() => rolesService.update(id, { name: form.name, description: form.description, permissionKeys }));
  }
  const current = role.data;
  return (
    <section className={styles.page}>
      <AccessNav />
      <Breadcrumb items={[{ label: "Perfis", to: "/roles" }, { label: current?.name ?? "Detalhes" }]} />
      {role.loading && <Loading />}
      {role.error && <ErrorState error={role.error} onRetry={role.reload} />}
      {error !== undefined && <ErrorState error={error} />}
      {current && (
        <>
          <header className={styles.header}>
            <div><span>PERFIL</span><h1>{current.name}</h1><p className={styles.mono}>{current.key}</p></div>
            <div className={styles.headerActions}>
              <Badge tone={current.system ? "warning" : "neutral"}>{current.system ? "Sistema" : "Personalizado"}</Badge>
              <Badge tone={current.active ? "success" : "danger"}>{current.active ? "Ativo" : "Inativo"}</Badge>
            </div>
          </header>
          <div className={styles.detailGrid}>
            <Card>
              <h2>Dados do perfil</h2>
              <form className={styles.form} onSubmit={(event) => void save(event)}>
                <Field label="Nome"><Input required value={form.name} disabled={!canManage} onChange={(event) => setForm((old) => ({ ...old, name: event.target.value }))} /></Field>
                <Field label="Descrição"><Input value={form.description} disabled={!canManage} onChange={(event) => setForm((old) => ({ ...old, description: event.target.value }))} /></Field>
                <Field label="Chave (imutável)"><Input value={current.key} readOnly disabled /></Field>
                {current.system && <p className={styles.muted}>Perfis de sistema não podem ser desativados nem excluídos; nome, descrição e permissões podem ser ajustados.</p>}
                {canManage && <Button type="submit">Salvar alterações</Button>}
              </form>
            </Card>
            <Card>
              <h2>Permissões</h2>
              {catalog.loading && <Loading label="Carregando catálogo…" />}
              {catalog.data && <PermissionPicker groups={catalog.data} selected={permissionKeys} onToggle={toggle} disabled={!canManage} />}
              {canManage && <div className={styles.dangerZone}>
                {current.active
                  ? <Button secondary disabled={current.system} onClick={() => void act(() => rolesService.update(id, { active: false }))}>Desativar perfil</Button>
                  : <Button secondary onClick={() => void act(() => rolesService.update(id, { active: true }))}>Reativar perfil</Button>}
                <Button secondary disabled={current.system} onClick={() => { if (window.confirm("Excluir este perfil? Esta ação é permanente.")) void (async () => { setError(undefined); try { await rolesService.remove(id); navigate("/roles"); } catch (cause) { setError(cause); } })(); }}>Excluir perfil</Button>
              </div>}
            </Card>
          </div>
        </>
      )}
    </section>
  );
}
