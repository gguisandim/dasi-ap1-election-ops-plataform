import { useEffect, useMemo, useState } from "react";
import { Breadcrumb, Button, Card, ErrorState, Loading, useAsync } from "@eops/ui";
import { notificationService, type NotificationPreference } from "../services/notificationService";
import styles from "../styles/notifications.module.css";

export function NotificationPreferencesPage() {
  const { data, loading, error, reload } = useAsync(notificationService.preferences, []);
  const [preferences, setPreferences] = useState<NotificationPreference[]>([]);
  const [saving, setSaving] = useState(false); const [message, setMessage] = useState(""); const [saveError, setSaveError] = useState<unknown>();
  useEffect(() => { if (data) setPreferences(data); }, [data]);
  const groups = useMemo(() => Object.entries(preferences.reduce<Record<string, NotificationPreference[]>>((acc, item) => { (acc[item.domain] ??= []).push(item); return acc; }, {})), [preferences]);
  async function save() { setSaving(true); setMessage(""); setSaveError(undefined); try { const result = await notificationService.updatePreferences(preferences.map(({ eventName, enabled }) => ({ eventName, enabled }))); setPreferences(result); setMessage("Preferências salvas com sucesso."); } catch (cause) { setSaveError(cause); } finally { setSaving(false); } }
  return <section className={styles.page}><Breadcrumb items={[{ label: "Notificações", to: "/notifications" }, { label: "Preferências" }]} /><header><div><span>PERSONALIZAÇÃO</span><h1>Preferências de notificações</h1><p>Escolha quais eventos elegíveis devem gerar notificações para sua conta.</p></div><Button disabled={saving || !preferences.length} onClick={() => void save()}>{saving ? "Salvando…" : "Salvar preferências"}</Button></header>
    {loading && <Loading />}{error && <ErrorState error={error} onRetry={reload} />}{saveError !== undefined && <ErrorState error={saveError} />}{message && <p className={styles.successMessage} role="status">{message}</p>}
    <div className={styles.preferenceGroups}>{groups.map(([domain, items]) => <Card key={domain}><h2>{domain}</h2><div className={styles.preferenceList}>{items.map((item) => <label key={item.eventName}><input type="checkbox" checked={item.enabled} onChange={(event) => setPreferences((current) => current.map((candidate) => candidate.eventName === item.eventName ? { ...candidate, enabled: event.target.checked } : candidate))} /><span><strong>{item.label}</strong><small>{item.description}</small><code>{item.eventName}</code></span></label>)}</div></Card>)}</div>
  </section>;
}
