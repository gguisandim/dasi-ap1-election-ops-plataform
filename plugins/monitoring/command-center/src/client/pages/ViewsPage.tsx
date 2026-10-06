import { useState } from "react";
import {
  Badge,
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
import { OPERATIONAL_SOURCE_LABELS } from "@eops/shared/command-center";
import { useHasPermission } from "../hooks/useHasPermission";
import { commandCenterService, SOURCE_ORDER } from "../services/commandCenterService";
import type { SavedView, SavedViewInput } from "../../types";
import styles from "../styles/command-center.module.css";

interface FormState {
  id?: string;
  name: string;
  description: string;
  sourceType: string;
  severity: string;
  refreshSeconds: number;
  layoutMode: "STANDARD" | "WALLBOARD";
  isDefault: boolean;
  shared: boolean;
}

const EMPTY_FORM: FormState = {
  name: "",
  description: "",
  sourceType: "",
  severity: "",
  refreshSeconds: 45,
  layoutMode: "STANDARD",
  isDefault: false,
  shared: false,
};

function toInput(form: FormState): SavedViewInput {
  return {
    name: form.name,
    description: form.description || undefined,
    filters: {
      sourceType: form.sourceType ? [form.sourceType] : undefined,
      severity: form.severity ? [form.severity] : undefined,
    },
    refreshSeconds: form.refreshSeconds,
    layoutMode: form.layoutMode,
    isDefault: form.isDefault,
    shared: form.shared,
  };
}

export function ViewsPage() {
  const canManage = useHasPermission("command-center.manage").allowed;
  const views = useAsync(commandCenterService.views, []);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<Error>();

  const reset = () => {
    setForm(EMPTY_FORM);
    setError(undefined);
  };

  const startEdit = (view: SavedView) => {
    setError(undefined);
    setForm({
      id: view.id,
      name: view.name,
      description: view.description ?? "",
      sourceType: view.filters.sourceType?.[0] ?? "",
      severity: view.filters.severity?.[0] ?? "",
      refreshSeconds: view.refreshSeconds,
      layoutMode: view.layoutMode,
      isDefault: view.isDefault,
      shared: view.shared,
    });
  };

  const submit = async () => {
    setSaving(true);
    setError(undefined);
    try {
      if (form.id) await commandCenterService.updateView(form.id, toInput(form));
      else await commandCenterService.createView(toInput(form));
      reset();
      views.reload();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause : new Error("Não foi possível salvar."),
      );
    } finally {
      setSaving(false);
    }
  };

  const act = async (operation: () => Promise<unknown>) => {
    setError(undefined);
    try {
      await operation();
      views.reload();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause : new Error("Operação não concluída."),
      );
    }
  };

  return (
    <section className={styles.page}>
      <Breadcrumb
        items={[
          { label: "Central de Comando", to: "/command-center" },
          { label: "Visões salvas" },
        ]}
      />
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>CONFIGURAÇÃO</span>
          <h1>Visões salvas</h1>
          <p>
            Filtros e intervalo de atualização por operador. Visões privadas são
            visíveis apenas para o dono; compartilhadas exigem{" "}
            <code>command-center.manage</code>.
          </p>
        </div>
        <div className={styles.headerActions}>
          <LinkButton secondary to="/command-center">
            Voltar ao painel
          </LinkButton>
        </div>
      </header>

      <div className={styles.layout}>
        <Card>
          <div className={styles.sectionTitle}>
            <h2>Minhas visões e compartilhadas</h2>
            <Button secondary onClick={views.reload}>
              Atualizar
            </Button>
          </div>
          {views.loading && <Loading label="Carregando visões…" />}
          {views.error && <ErrorState error={views.error} onRetry={views.reload} />}
          {views.data?.length === 0 && (
            <EmptyState
              title="Nenhuma visão salva"
              description="Crie uma visão para fixar filtros e intervalo de atualização."
            />
          )}
          {views.data && views.data.length > 0 && (
            <ul className={styles.viewList}>
              {views.data.map((view) => (
                <li key={view.id} className={styles.viewCard}>
                  <div>
                    <h3>
                      {view.name}{" "}
                      {view.isDefault && <Badge tone="success">padrão</Badge>}{" "}
                      {view.shared && <Badge tone="warning">compartilhada</Badge>}
                    </h3>
                    <p>{view.description ?? "Sem descrição."}</p>
                    <p className={styles.muted}>
                      {view.layoutMode} · {view.refreshSeconds}s
                      {view.filters.sourceType?.length
                        ? ` · origem ${view.filters.sourceType
                            .map(
                              (value) =>
                                OPERATIONAL_SOURCE_LABELS[
                                  value as keyof typeof OPERATIONAL_SOURCE_LABELS
                                ] ?? value,
                            )
                            .join(", ")}`
                        : ""}
                      {view.owner ? ` · dono ${view.owner.name}` : ""}
                    </p>
                  </div>
                  <div className={styles.viewCardActions}>
                    {view.editable ? (
                      <>
                        <Button secondary onClick={() => startEdit(view)}>
                          Editar
                        </Button>
                        <Button
                          secondary
                          onClick={() =>
                            void act(() =>
                              commandCenterService.updateView(view.id, {
                                isDefault: !view.isDefault,
                              }),
                            )
                          }
                        >
                          {view.isDefault ? "Remover padrão" : "Definir padrão"}
                        </Button>
                        <Button
                          secondary
                          onClick={() =>
                            void act(() =>
                              commandCenterService.updateView(view.id, {
                                shared: !view.shared,
                              }),
                            )
                          }
                          disabled={!canManage && !view.shared}
                        >
                          {view.shared ? "Descompartilhar" : "Compartilhar"}
                        </Button>
                        <Button
                          onClick={() =>
                            void act(() => commandCenterService.removeView(view.id))
                          }
                        >
                          Remover
                        </Button>
                      </>
                    ) : (
                      <span className={styles.muted}>
                        Somente leitura para o seu perfil.
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <div className={styles.sectionTitle}>
            <h2>{form.id ? "Editar visão" : "Nova visão"}</h2>
          </div>
          {error && <ErrorState error={error} />}
          <div className={styles.form}>
            <Field label="Nome">
              <Input
                value={form.name}
                maxLength={80}
                onChange={(event) =>
                  setForm({ ...form, name: event.target.value })
                }
              />
            </Field>
            <Field label="Descrição">
              <Input
                value={form.description}
                maxLength={500}
                onChange={(event) =>
                  setForm({ ...form, description: event.target.value })
                }
              />
            </Field>
            <div className={styles.formGrid}>
              <Field label="Origem do sinal">
                <Select
                  value={form.sourceType}
                  onChange={(event) =>
                    setForm({ ...form, sourceType: event.target.value })
                  }
                >
                  <option value="">Todas</option>
                  {SOURCE_ORDER.map((value) => (
                    <option key={value} value={value}>
                      {OPERATIONAL_SOURCE_LABELS[value]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Severidade">
                <Select
                  value={form.severity}
                  onChange={(event) =>
                    setForm({ ...form, severity: event.target.value })
                  }
                >
                  <option value="">Todas</option>
                  {["CRITICAL", "HIGH", "MEDIUM", "LOW"].map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Modo">
                <Select
                  value={form.layoutMode}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      layoutMode: event.target.value as FormState["layoutMode"],
                    })
                  }
                >
                  <option value="STANDARD">Padrão</option>
                  <option value="WALLBOARD">Painel</option>
                </Select>
              </Field>
              <Field label="Atualização (s)">
                <Input
                  type="number"
                  min={15}
                  max={300}
                  value={form.refreshSeconds}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      refreshSeconds: Number(event.target.value),
                    })
                  }
                />
              </Field>
            </div>
            <label className={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={form.isDefault}
                onChange={(event) =>
                  setForm({ ...form, isDefault: event.target.checked })
                }
              />
              Usar como visão padrão
            </label>
            <label className={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={form.shared}
                disabled={!canManage}
                onChange={(event) =>
                  setForm({ ...form, shared: event.target.checked })
                }
              />
              Compartilhar com a equipe{!canManage && " (requer permissão de gestão)"}
            </label>
            <div className={styles.headerActions}>
              <Button onClick={() => void submit()} disabled={saving || !form.name}>
                {saving ? "Salvando…" : form.id ? "Salvar alterações" : "Criar visão"}
              </Button>
              {form.id && (
                <Button secondary onClick={reset}>
                  Cancelar edição
                </Button>
              )}
            </div>
          </div>
        </Card>
      </div>
    </section>
  );
}
