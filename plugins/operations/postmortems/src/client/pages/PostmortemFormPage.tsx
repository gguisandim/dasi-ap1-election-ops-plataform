import { useState } from "react";
import {
  Breadcrumb,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Input,
  LinkButton,
  Loading,
  Select,
  useAsync,
} from "@eops/ui";
import { formatDateTime } from "@eops/shared/format";
import { Link, useNavigate } from "react-router-dom";
import { SeverityBadge } from "../components/PostmortemBadges";
import { postmortemsService } from "../services/postmortemsService";
import styles from "../styles/postmortems.module.css";

export function PostmortemFormPage() {
  const navigate = useNavigate();
  const references = useAsync(postmortemsService.references, []);
  const [form, setForm] = useState({
    primaryIncidentId: "",
    title: "",
    ownerId: "",
  });
  const [error, setError] = useState<Error>();
  const [saving, setSaving] = useState(false);

  const selected = (references.data?.incidents ?? []).find(
    (incident) => incident.id === form.primaryIncidentId,
  );

  const create = async () => {
    setSaving(true);
    setError(undefined);
    try {
      const record = await postmortemsService.create({
        primaryIncidentId: form.primaryIncidentId,
        title: form.title,
        ownerId: form.ownerId || undefined,
      });
      navigate(`/postmortems/${record.id}`);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause
          : new Error("Não foi possível criar a análise."),
      );
    } finally {
      setSaving(false);
    }
  };

  const taken = (references.data?.incidents ?? []).filter(
    (incident) => incident.hasActivePostmortem,
  );
  const available = (references.data?.incidents ?? []).filter(
    (incident) => !incident.hasActivePostmortem,
  );

  return (
    <section className={styles.page}>
      <Breadcrumb
        items={[
          { label: "Postmortem", to: "/postmortems/dashboard" },
          { label: "Nova análise" },
        ]}
      />
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>NOVA ANÁLISE</span>
          <h1>Nova análise pós-incidente</h1>
          <p>
            Somente incidentes resolvidos ou encerrados, e sem postmortem ativo,
            podem receber uma nova análise.
          </p>
        </div>
        <div className={styles.headerActions}>
          <LinkButton secondary to="/postmortems/dashboard">
            Cancelar
          </LinkButton>
        </div>
      </header>

      {references.loading && <Loading label="Carregando incidentes elegíveis…" />}
      {references.error && (
        <ErrorState error={references.error} onRetry={references.reload} />
      )}
      {error && <ErrorState error={error} />}

      {references.data && available.length === 0 && (
        <EmptyState
          title="Nenhum incidente elegível"
          description="Não há incidentes resolvidos ou encerrados sem postmortem ativo."
          action={
            <LinkButton to="/incidents">Ver incidentes</LinkButton>
          }
        />
      )}

      {references.data && available.length > 0 && (
        <div className={styles.layout}>
          <Card>
            <div className={styles.form}>
              <Field label="Incidente primário">
                <Select
                  value={form.primaryIncidentId}
                  onChange={(event) => {
                    const incident = available.find(
                      (item) => item.id === event.target.value,
                    );
                    setForm((current) => ({
                      ...current,
                      primaryIncidentId: event.target.value,
                      title: incident
                        ? `Análise: ${incident.code} · ${incident.title}`
                        : current.title,
                    }));
                  }}
                >
                  <option value="">Selecione</option>
                  {available.map((incident) => (
                    <option key={incident.id} value={incident.id}>
                      {incident.code} · {incident.title} ({incident.severity})
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Título">
                <Input
                  value={form.title}
                  maxLength={200}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="Responsável pela análise">
                <Select
                  value={form.ownerId}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      ownerId: event.target.value,
                    }))
                  }
                >
                  <option value="">Eu mesmo</option>
                  {(references.data?.users ?? []).map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Button
                onClick={() => void create()}
                disabled={
                  saving || !form.primaryIncidentId || form.title.trim().length < 4
                }
              >
                {saving ? "Criando…" : "Criar análise"}
              </Button>
            </div>
          </Card>

          <div className={styles.stack}>
            {selected && (
              <Card>
                <div className={styles.sectionTitle}>
                  <h2>Incidente selecionado</h2>
                </div>
                <dl className={styles.definitionGrid}>
                  <dt>Código</dt>
                  <dd>
                    <Link to={`/incidents/${selected.id}`}>{selected.code}</Link>
                  </dd>
                  <dt>Título</dt>
                  <dd>{selected.title}</dd>
                  <dt>Severidade</dt>
                  <dd>
                    <SeverityBadge severity={selected.severity} />
                  </dd>
                  <dt>Status</dt>
                  <dd>{selected.status}</dd>
                  <dt>Aberto em</dt>
                  <dd>{formatDateTime(selected.openedAt)}</dd>
                  <dt>Resolvido em</dt>
                  <dd>
                    {selected.resolvedAt
                      ? formatDateTime(selected.resolvedAt)
                      : "—"}
                  </dd>
                </dl>
              </Card>
            )}
            {taken.length > 0 && (
              <Card>
                <div className={styles.sectionTitle}>
                  <h2>Já possuem postmortem ativo</h2>
                </div>
                <ul className={styles.cardList}>
                  {taken.slice(0, 8).map((incident) => (
                    <li key={incident.id} className={styles.cardItem}>
                      <strong>{incident.code}</strong>
                      <p>{incident.title}</p>
                    </li>
                  ))}
                </ul>
                <p className={styles.muted}>
                  Um incidente aceita apenas um postmortem não arquivado por vez.
                </p>
              </Card>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
