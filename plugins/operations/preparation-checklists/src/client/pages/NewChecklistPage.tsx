import { Button, Card, ErrorState, Field, Loading, Select, useAsync } from "@eops/ui";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { PreparationNav } from "../components/PreparationNav";
import { preparationChecklistsService } from "../services/preparationChecklistsService";
import styles from "../styles/preparationChecklists.module.css";

export function NewChecklistPage() {
  const navigate = useNavigate();
  const references = useAsync(preparationChecklistsService.references, []);
  const templates = useAsync(() => preparationChecklistsService.templates(true), []);
  const [form, setForm] = useState({ electionId: "", electoralZoneId: "", pollingPlaceId: "", templateId: "", assigneeId: "" });
  const [error, setError] = useState<Error>();
  const zones = references.data?.zones.filter((zone) => zone.electionId === form.electionId) ?? [];
  const places = references.data?.places.filter((place) => place.electoralZoneId === form.electoralZoneId) ?? [];
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(undefined);
    try { const result = await preparationChecklistsService.createChecklist(form); navigate(`/preparation-checklists/${result.id}`); }
    catch (reason) { setError(reason instanceof Error ? reason : new Error("Não foi possível criar o checklist.")); }
  }
  return <section className={styles.page}><PreparationNav /><header className={styles.header}><div><span>NOVA INSTÂNCIA</span><h1>Criar checklist</h1><p>Associe um modelo ao pleito e ao local de votação.</p></div></header>{(references.loading || templates.loading) && <Loading />}{(references.error || templates.error) && <ErrorState error={references.error ?? templates.error} onRetry={() => { references.reload(); templates.reload(); }} />}{error && <ErrorState error={error} />}{references.data && templates.data && <Card className={styles.formCard}><form className={styles.form} onSubmit={submit}><Field label="Pleito"><Select required value={form.electionId} onChange={(event) => setForm((value) => ({ ...value, electionId: event.target.value, electoralZoneId: "", pollingPlaceId: "" }))}><option value="">Selecione</option>{references.data.elections.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.year}</option>)}</Select></Field><Field label="Zona eleitoral"><Select required disabled={!form.electionId} value={form.electoralZoneId} onChange={(event) => setForm((value) => ({ ...value, electoralZoneId: event.target.value, pollingPlaceId: "" }))}><option value="">Selecione</option>{zones.map((item) => <option key={item.id} value={item.id}>Zona {item.number} · {item.name}</option>)}</Select></Field><Field label="Local de votação"><Select required disabled={!form.electoralZoneId} value={form.pollingPlaceId} onChange={(event) => setForm((value) => ({ ...value, pollingPlaceId: event.target.value }))}><option value="">Selecione</option>{places.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field><Field label="Modelo"><Select required value={form.templateId} onChange={(event) => setForm((value) => ({ ...value, templateId: event.target.value }))}><option value="">Selecione</option>{templates.data.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.items.length} itens</option>)}</Select></Field><Field label="Responsável"><Select required value={form.assigneeId} onChange={(event) => setForm((value) => ({ ...value, assigneeId: event.target.value }))}><option value="">Selecione</option>{references.data.users.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.email}</option>)}</Select></Field><Button type="submit">Criar checklist</Button></form></Card>}</section>;
}