import { useState, type FormEvent } from "react";
import { Badge, Button, Card, EmptyState, ErrorState, Field, Input, LinkButton, Loading, Select, useAsync } from "@eops/ui";
import { transmissionService } from "../../services/transmissionService";
import { useHasPermission } from "../hooks/usePermissions";
import type { TransmissionProvider, TransmissionProviderInput } from "../../types";
import styles from "../../styles/overview.module.css";

const EMPTY: TransmissionProviderInput = { code: "", name: "", contact: "", slaTargetUptimePercent: undefined, notes: "", active: true };
const numberOrUndefined = (value: string) => (value === "" ? undefined : Number(value));

/** Cadastro e edição de provedores de conectividade (SPEC 3.2). */
export function TransmissionProvidersPage() {
  const providers = useAsync(transmissionService.providers, []);
  const { allowed: canManage } = useHasPermission("transmission.manage");
  const [form, setForm] = useState<TransmissionProviderInput>(EMPTY);
  const [editing, setEditing] = useState<TransmissionProvider | null>(null);
  const [error, setError] = useState<Error>();

  function reset() { setForm(EMPTY); setEditing(null); }
  function startEdit(provider: TransmissionProvider) {
    setEditing(provider);
    setForm({ code: provider.code, name: provider.name, contact: provider.contact ?? "", slaTargetUptimePercent: provider.slaTargetUptimePercent === null ? undefined : Number(provider.slaTargetUptimePercent), notes: provider.notes ?? "", active: provider.active });
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(undefined);
    try {
      if (editing) await transmissionService.updateProvider(editing.id, { name: form.name, contact: form.contact || undefined, slaTargetUptimePercent: form.slaTargetUptimePercent, notes: form.notes || undefined, active: form.active });
      else await transmissionService.createProvider({ ...form, code: form.code?.toUpperCase() });
      reset();
      providers.reload();
    } catch (reason) { setError(reason instanceof Error ? reason : new Error("Falha ao salvar provedor.")); }
  }
  async function toggleActive(provider: TransmissionProvider) {
    setError(undefined);
    try { await transmissionService.updateProvider(provider.id, { active: !provider.active }); providers.reload(); }
    catch (reason) { setError(reason instanceof Error ? reason : new Error("Falha ao atualizar provedor.")); }
  }

  return <section className={styles.page}>
    <header className={styles.header}><div><span className={styles.tag}>NOC · PROVEDORES</span><h1>Provedores de conectividade</h1><p>Operadoras e links contratados; o alvo de uptime alimenta o SLA dos circuitos associados.</p></div><div className={styles.actions}><LinkButton secondary to="/transmission/analytics">SLA e analytics</LinkButton><LinkButton secondary to="/transmission">Dashboard</LinkButton></div></header>
    {error && <ErrorState error={error} />}

    <div className={styles.grid2}>
      <Card>
        <div className={styles.sectionTitle}><h2>Provedores</h2><span>{providers.data?.length ?? 0}</span></div>
        {providers.loading && <Loading label="Carregando provedores…" />}
        {providers.error && <ErrorState error={providers.error} onRetry={providers.reload} />}
        {providers.data?.length === 0 && <EmptyState title="Nenhum provedor" description="Cadastre o primeiro provedor para vincular aos circuitos." />}
        {providers.data && providers.data.length > 0 && <div className={styles.tableWrap}><table><thead><tr><th>Código</th><th>Nome</th><th>Contato</th><th>Alvo SLA</th><th>Circuitos</th><th>Situação</th><th /></tr></thead><tbody>{providers.data.map((provider) => <tr key={provider.id}><td>{provider.code}</td><td>{provider.name}<small>{provider.notes ?? ""}</small></td><td>{provider.contact ?? "—"}</td><td className={styles.mono}>{provider.slaTargetUptimePercent === null ? "—" : `${Number(provider.slaTargetUptimePercent)}%`}</td><td className={styles.mono}>{provider.circuitCount ?? 0}</td><td><Badge tone={provider.active ? "success" : "neutral"}>{provider.active ? "Ativo" : "Inativo"}</Badge></td><td>{canManage && <div className={styles.rowActions}><Button secondary onClick={() => startEdit(provider)}>Editar</Button><Button onClick={() => void toggleActive(provider)}>{provider.active ? "Desativar" : "Ativar"}</Button></div>}</td></tr>)}</tbody></table></div>}
      </Card>

      <Card>
        <h2>{editing ? `Editar ${editing.code}` : "Novo provedor"}</h2>
        {!canManage ? <p className={styles.gateMessage}>Você não possui a permissão de gerenciamento para cadastrar ou editar provedores.</p> : <form className={styles.form} onSubmit={submit}>
          <Field label="Código"><Input required disabled={Boolean(editing)} value={form.code ?? ""} onChange={(event) => setForm((value) => ({ ...value, code: event.target.value }))} /></Field>
          <Field label="Nome"><Input required value={form.name} onChange={(event) => setForm((value) => ({ ...value, name: event.target.value }))} /></Field>
          <Field label="Contato"><Input value={form.contact ?? ""} onChange={(event) => setForm((value) => ({ ...value, contact: event.target.value }))} /></Field>
          <Field label="Alvo de uptime (%)"><Input max="100" min="0" step="0.01" type="number" value={form.slaTargetUptimePercent ?? ""} onChange={(event) => setForm((value) => ({ ...value, slaTargetUptimePercent: numberOrUndefined(event.target.value) }))} /></Field>
          <Field label="Situação"><Select value={form.active ? "true" : "false"} onChange={(event) => setForm((value) => ({ ...value, active: event.target.value === "true" }))}><option value="true">Ativo</option><option value="false">Inativo</option></Select></Field>
          <Field label="Observações"><Input value={form.notes ?? ""} onChange={(event) => setForm((value) => ({ ...value, notes: event.target.value }))} /></Field>
          <div className={styles.rowActions}><Button type="submit">{editing ? "Salvar alterações" : "Cadastrar provedor"}</Button>{editing && <Button secondary type="button" onClick={reset}>Cancelar</Button>}</div>
        </form>}
      </Card>
    </div>
  </section>;
}
