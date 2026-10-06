import { useState, type FormEvent } from "react";
import { Button, Card, EmptyState, ErrorState, Field, Input, LinkButton, Loading, Select, useAsync } from "@eops/ui";
import { formatDateTime } from "@eops/shared/format";
import { inventoryService } from "../services/inventoryService";
import styles from "../styles/inventory.module.css";

export function ReservationsPage() {
  const reservations = useAsync(inventoryService.reservations, []);
  const assets = useAsync(() => inventoryService.list({ pageSize: 100 }), []);
  const [form, setForm] = useState({ assetId: "", requesterName: "", purpose: "", startsAt: "", endsAt: "", notes: "" });
  const [error, setError] = useState<Error>();
  const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(undefined);
    try {
      await inventoryService.createReservation({ ...form, startsAt: new Date(form.startsAt).toISOString(), endsAt: new Date(form.endsAt).toISOString() });
      setForm({ assetId: "", requesterName: "", purpose: "", startsAt: "", endsAt: "", notes: "" });
      reservations.reload();
    } catch (reason) { setError(reason instanceof Error ? reason : new Error("Não foi possível criar a reserva.")); }
    finally { setSaving(false); }
  }
  async function action(id: string, name: "approve" | "cancel") {
    setError(undefined);
    try { if (name === "approve") await inventoryService.approveReservation(id); else await inventoryService.cancelReservation(id, "Cancelada pelo operador"); reservations.reload(); }
    catch (reason) { setError(reason instanceof Error ? reason : new Error("Não foi possível atualizar a reserva.")); }
  }
  return <section className={styles.page}>
    <header className={styles.header}><div><span className={styles.eyebrow}>INVENTÁRIO</span><h1>Reservas de ativos</h1><p>Planeje a disponibilidade sem confundir reserva com custódia física.</p></div><LinkButton secondary to="/inventory">Voltar ao inventário</LinkButton></header>
    {error && <ErrorState error={error} />}
    <div className={styles.detailGrid}><Card><h2>Nova reserva</h2><form className={styles.actions} onSubmit={submit}>
      <Field label="Ativo"><Select required value={form.assetId} onChange={(event) => setForm((value) => ({ ...value, assetId: event.target.value }))}><option value="">Selecione</option>{assets.data?.items.map((asset) => <option key={asset.id} value={asset.id}>{asset.assetTag} · {asset.name}</option>)}</Select></Field>
      <Field label="Solicitante"><Input required value={form.requesterName} onChange={(event) => setForm((value) => ({ ...value, requesterName: event.target.value }))} /></Field>
      <Field label="Finalidade"><Input required minLength={3} value={form.purpose} onChange={(event) => setForm((value) => ({ ...value, purpose: event.target.value }))} /></Field>
      <Field label="Início"><Input required type="datetime-local" value={form.startsAt} onChange={(event) => setForm((value) => ({ ...value, startsAt: event.target.value }))} /></Field>
      <Field label="Fim"><Input required type="datetime-local" value={form.endsAt} onChange={(event) => setForm((value) => ({ ...value, endsAt: event.target.value }))} /></Field>
      <Field label="Observação"><Input value={form.notes} onChange={(event) => setForm((value) => ({ ...value, notes: event.target.value }))} /></Field>
      <Button disabled={saving} type="submit">{saving ? "Salvando…" : "Solicitar reserva"}</Button>
    </form></Card><Card><h2>Fluxo operacional</h2><p>Reservas pendentes precisam de aprovação. A retirada vinculada cumpre a reserva e inicia uma custódia separada.</p></Card></div>
    {reservations.loading && <Loading label="Carregando reservas…" />}{reservations.error && <ErrorState error={reservations.error} onRetry={reservations.reload} />}
    {reservations.data?.length === 0 && <EmptyState title="Sem reservas" description="Nenhuma reserva foi registrada." />}
    {reservations.data && reservations.data.length > 0 && <div className={styles.tableWrap}><table><thead><tr><th>Ativo</th><th>Solicitante</th><th>Período</th><th>Status</th><th>Ações</th></tr></thead><tbody>{reservations.data.map((item) => <tr key={item.id}><td>{item.asset ? `${item.asset.assetTag} · ${item.asset.name}` : item.assetId}</td><td>{item.requesterName}<small>{item.purpose}</small></td><td>{formatDateTime(item.startsAt)}<small>até {formatDateTime(item.endsAt)}</small></td><td>{item.status}</td><td><div className={styles.headerActions}>{item.status === "REQUESTED" && <Button onClick={() => void action(item.id, "approve")}>Aprovar</Button>}{!["CANCELLED", "FULFILLED"].includes(item.status) && <Button onClick={() => void action(item.id, "cancel")}>Cancelar</Button>}</div></td></tr>)}</tbody></table></div>}
  </section>;
}
