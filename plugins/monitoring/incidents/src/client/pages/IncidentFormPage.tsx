import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Button, ErrorState, Field, Input, Loading, Select } from "@eops/ui";
import { INCIDENT_SEVERITIES, INCIDENT_SEVERITY_LABELS, type IncidentCategorySummary, type IncidentSeverity } from "@eops/shared/incidents";
import { type AssetSummary } from "@eops/shared/inventory";
import { type ElectionSummary, type ElectoralZoneSummary, type PollingPlaceSummary } from "@eops/shared/elections";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { incidentService } from "../services/incidentService";
import styles from "../styles/incidents.module.css";

interface FormState { title: string; description: string; severity: IncidentSeverity; electionId: string; electoralZoneId: string; pollingPlaceId: string; categoryId: string; assetId: string; slaDeadline: string; }
const initial: FormState = { title: "", description: "", severity: "MEDIUM", electionId: "", electoralZoneId: "", pollingPlaceId: "", categoryId: "", assetId: "", slaDeadline: "" };

export function IncidentFormPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>({ ...initial, pollingPlaceId: searchParams.get("pollingPlaceId") ?? "", electionId: searchParams.get("electionId") ?? "", electoralZoneId: searchParams.get("zoneId") ?? "" });
  const [elections, setElections] = useState<ElectionSummary[]>([]);
  const [zones, setZones] = useState<ElectoralZoneSummary[]>([]);
  const [places, setPlaces] = useState<PollingPlaceSummary[]>([]);
  const [categories, setCategories] = useState<IncidentCategorySummary[]>([]);
  const [assets, setAssets] = useState<AssetSummary[]>([]);
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [error, setError] = useState<unknown>();
  useEffect(() => { void (async () => { try {
    const [reference, categoryData, incident] = await Promise.all([incidentService.referenceData(), incidentService.categories(), id ? incidentService.get(id) : Promise.resolve(null)]);
    setElections(reference.elections); setZones(reference.zones); setPlaces(reference.places); setAssets(reference.assets); setCategories(categoryData.filter((item) => item.active));
    if (incident) setForm({ title: incident.title, description: incident.description, severity: incident.severity, electionId: incident.electionId, electoralZoneId: incident.electoralZoneId ?? "", pollingPlaceId: incident.pollingPlaceId ?? "", categoryId: incident.categoryId, assetId: incident.asset?.id ?? "", slaDeadline: incident.slaDeadline?.slice(0, 16) ?? "" });
    else {
      const selectedPlace = reference.places.find((place) => place.id === (searchParams.get("pollingPlaceId") ?? ""));
      if (selectedPlace) setForm((current) => ({ ...current, electionId: selectedPlace.electoralZone.election.id, electoralZoneId: selectedPlace.electoralZone.id }));
    }
  } catch (cause) { setError(cause); } finally { setLoading(false); } })(); }, [id]);
  const visibleZones = useMemo(() => zones.filter((zone) => !form.electionId || zone.electionId === form.electionId), [zones, form.electionId]);
  const visiblePlaces = useMemo(() => places.filter((place) => !form.electoralZoneId || place.electoralZoneId === form.electoralZoneId), [places, form.electoralZoneId]);
  const set = (key: keyof FormState, value: string) => setForm((current) => ({ ...current, [key]: value }));
  async function submit(event: FormEvent) { event.preventDefault(); setSaving(true); setError(undefined); try {
    const payload = { ...form, electoralZoneId: form.electoralZoneId || undefined, pollingPlaceId: form.pollingPlaceId || undefined, slaDeadline: form.slaDeadline ? new Date(form.slaDeadline).toISOString() : undefined };
    const saved = id ? await incidentService.update(id, payload) : await incidentService.create(payload);
    navigate(`/incidents/${saved.id}`);
  } catch (cause) { setError(cause); } finally { setSaving(false); } }
  if (loading) return <Loading />;
  return <section className={styles.page}><h1>{id ? "Editar incidente" : "Novo incidente"}</h1>{error !== undefined && <ErrorState error={error} />}
    <form className={styles.form} onSubmit={(event) => void submit(event)}>
      <Field label="Título"><Input required minLength={3} value={form.title} onChange={(event) => set("title", event.target.value)} /></Field>
      <Field label="Descrição"><textarea required minLength={3} value={form.description} onChange={(event) => set("description", event.target.value)} /></Field>
      <div className={styles.formGrid}>
        <Field label="Severidade"><Select value={form.severity} onChange={(event) => set("severity", event.target.value)}>{INCIDENT_SEVERITIES.map((item) => <option key={item} value={item}>{INCIDENT_SEVERITY_LABELS[item]}</option>)}</Select></Field>
        <Field label="Categoria"><Select required value={form.categoryId} onChange={(event) => set("categoryId", event.target.value)}><option value="">Selecione</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field>
        <Field label="Prazo de SLA"><Input type="datetime-local" value={form.slaDeadline} onChange={(event) => set("slaDeadline", event.target.value)} /></Field>
        <Field label="Ativo relacionado"><Select value={form.assetId} onChange={(event) => set("assetId", event.target.value)}><option value="">Nenhum</option>{assets.filter((asset) => !form.pollingPlaceId || asset.pollingPlaceId === form.pollingPlaceId).map((asset) => <option key={asset.id} value={asset.id}>{asset.assetTag} — {asset.name}</option>)}</Select></Field>
        {!id && <><Field label="Pleito"><Select required value={form.electionId} onChange={(event) => setForm((current) => ({ ...current, electionId: event.target.value, electoralZoneId: "", pollingPlaceId: "" }))}><option value="">Selecione</option>{elections.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field>
        <Field label="Zona"><Select value={form.electoralZoneId} onChange={(event) => setForm((current) => ({ ...current, electoralZoneId: event.target.value, pollingPlaceId: "" }))}><option value="">Nenhuma</option>{visibleZones.map((item) => <option key={item.id} value={item.id}>Zona {item.number} — {item.municipality}</option>)}</Select></Field>
        <Field label="Local"><Select value={form.pollingPlaceId} onChange={(event) => set("pollingPlaceId", event.target.value)}><option value="">Nenhum</option>{visiblePlaces.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field></>}
      </div><Button disabled={saving} type="submit">{saving ? "Salvando…" : "Salvar incidente"}</Button>
    </form></section>;
}
