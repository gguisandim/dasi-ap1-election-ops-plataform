import { useState, type FormEvent } from "react";
import { Button, Card, EmptyState, ErrorState, Field, Input, LinkButton, Loading, Select, useAsync } from "@eops/ui";
import { formatDateTime } from "@eops/shared/format";
import { inventoryService } from "../services/inventoryService";
import styles from "../styles/inventory.module.css";

export function MaintenancePage() {
  const maintenance = useAsync(inventoryService.maintenance, []);
  const assets = useAsync(() => inventoryService.list({ pageSize: 100 }), []);
  const [form, setForm] = useState({ assetId: "", type: "PREVENTIVE" as "PREVENTIVE" | "CORRECTIVE", description: "", responsible: "", cost: "", notes: "" });
  const [error, setError] = useState<Error>();
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(undefined);
    try { await inventoryService.createMaintenance({ ...form, cost: form.cost ? Number(form.cost) : undefined }); setForm({ assetId: "", type: "PREVENTIVE", description: "", responsible: "", cost: "", notes: "" }); maintenance.reload(); }
    catch (reason) { setError(reason instanceof Error ? reason : new Error("Não foi possível abrir a manutenção.")); }
  }
  async function action(id: string, name: "start" | "complete" | "cancel") {
    setError(undefined);
    try {
      if (name === "start") await inventoryService.startMaintenance(id);
      if (name === "complete") await inventoryService.completeMaintenance(id, { returnToService: true, result: "Serviço concluído e ativo liberado." });
      if (name === "cancel") await inventoryService.cancelMaintenance(id);
      maintenance.reload();
    } catch (reason) { setError(reason instanceof Error ? reason : new Error("Não foi possível atualizar a manutenção.")); }
  }
  return <section className={styles.page}>
    <header className={styles.header}><div><span className={styles.eyebrow}>INVENTÁRIO</span><h1>Manutenção</h1><p>Bloqueie ativos indisponíveis e preserve o histórico de serviço.</p></div><LinkButton secondary to="/inventory">Voltar ao inventário</LinkButton></header>
    {error && <ErrorState error={error} />}
    <div className={styles.detailGrid}><Card><h2>Abrir manutenção</h2><form className={styles.actions} onSubmit={submit}>
      <Field label="Ativo"><Select required value={form.assetId} onChange={(event) => setForm((value) => ({ ...value, assetId: event.target.value }))}><option value="">Selecione</option>{assets.data?.items.map((asset) => <option key={asset.id} value={asset.id}>{asset.assetTag} · {asset.name}</option>)}</Select></Field>
      <Field label="Tipo"><Select value={form.type} onChange={(event) => setForm((value) => ({ ...value, type: event.target.value as "PREVENTIVE" | "CORRECTIVE" }))}><option value="PREVENTIVE">Preventiva</option><option value="CORRECTIVE">Corretiva</option></Select></Field>
      <Field label="Descrição"><Input required minLength={3} value={form.description} onChange={(event) => setForm((value) => ({ ...value, description: event.target.value }))} /></Field>
      <Field label="Responsável"><Input required value={form.responsible} onChange={(event) => setForm((value) => ({ ...value, responsible: event.target.value }))} /></Field>
      <Field label="Custo"><Input min="0" type="number" value={form.cost} onChange={(event) => setForm((value) => ({ ...value, cost: event.target.value }))} /></Field>
      <Button type="submit">Abrir manutenção</Button>
    </form></Card><Card><h2>Regras</h2><p>Ativos em manutenção não podem ser retirados nem incluídos em novas cargas. A conclusão decide explicitamente se o ativo retorna ao serviço.</p></Card></div>
    {maintenance.loading && <Loading label="Carregando manutenções…" />}{maintenance.error && <ErrorState error={maintenance.error} onRetry={maintenance.reload} />}
    {maintenance.data?.length === 0 && <EmptyState title="Sem manutenções" description="Nenhum serviço foi registrado." />}
    {maintenance.data && maintenance.data.length > 0 && <div className={styles.tableWrap}><table><thead><tr><th>Ativo</th><th>Serviço</th><th>Responsável</th><th>Status</th><th>Abertura</th><th>Ações</th></tr></thead><tbody>{maintenance.data.map((item) => <tr key={item.id}><td>{item.asset ? `${item.asset.assetTag} · ${item.asset.name}` : item.assetId}</td><td>{item.type}<small>{item.description}</small></td><td>{item.responsible}</td><td>{item.status}</td><td>{formatDateTime(item.openedAt)}</td><td><div className={styles.headerActions}>{item.status === "OPEN" && <Button onClick={() => void action(item.id, "start")}>Iniciar</Button>}{["OPEN", "IN_PROGRESS"].includes(item.status) && <Button onClick={() => void action(item.id, "complete")}>Concluir</Button>}{["OPEN", "IN_PROGRESS"].includes(item.status) && <Button onClick={() => void action(item.id, "cancel")}>Cancelar</Button>}</div></td></tr>)}</tbody></table></div>}
  </section>;
}
