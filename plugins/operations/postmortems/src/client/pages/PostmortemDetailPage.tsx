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
import {
  POSTMORTEM_CAUSE_CATEGORY_LABELS,
  POSTMORTEM_CAUSE_TYPE_LABELS,
  POSTMORTEM_LESSON_TYPE_LABELS,
  POSTMORTEM_ACTION_STATUS_LABELS,
  type PostmortemCauseCategory,
  type PostmortemCauseType,
  type PostmortemLessonType,
} from "@eops/shared/postmortems";
import { Link, useParams } from "react-router-dom";
import { CauseTree } from "../components/CauseTree";
import {
  PostmortemStatusPill,
  PriorityBadge,
  SeverityBadge,
} from "../components/PostmortemBadges";
import { postmortemsService } from "../services/postmortemsService";
import type {
  PostmortemCause,
  PostmortemLesson,
  PostmortemActionItem,
} from "../../types";
import styles from "../styles/postmortems.module.css";

type Tab = "summary" | "causes" | "lessons" | "actions" | "timeline" | "review";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "summary", label: "Resumo executivo" },
  { id: "causes", label: "Causa raiz" },
  { id: "lessons", label: "Lições" },
  { id: "actions", label: "Ações corretivas" },
  { id: "timeline", label: "Timeline" },
  { id: "review", label: "Review" },
];

const SUMMARY_FIELDS = [
  { key: "executiveSummary", label: "Resumo executivo" },
  { key: "impactSummary", label: "Impacto" },
  { key: "detectionSummary", label: "Como foi detectado" },
  { key: "responseSummary", label: "Como respondemos" },
  { key: "resolutionSummary", label: "Como foi resolvido" },
  { key: "rootCauseSummary", label: "Causa raiz" },
  { key: "lessonsSummary", label: "Lições e mudanças" },
] as const;

const CAUSE_TYPES: PostmortemCauseType[] = [
  "ROOT_CAUSE",
  "CONTRIBUTING_FACTOR",
  "CONDITION",
];
const CAUSE_CATEGORIES: PostmortemCauseCategory[] = [
  "PEOPLE",
  "PROCESS",
  "TECHNOLOGY",
  "COMMUNICATION",
  "LOGISTICS",
  "EXTERNAL",
  "OTHER",
];
const LESSON_TYPES: PostmortemLessonType[] = [
  "WENT_WELL",
  "WENT_WRONG",
  "LESSON",
  "FOLLOW_UP",
];

interface CauseDraft {
  id?: string;
  parentId: string;
  type: PostmortemCauseType;
  category: PostmortemCauseCategory;
  statement: string;
  evidence: string;
}

export function PostmortemDetailPage() {
  const { id = "" } = useParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>("summary");
  const [error, setError] = useState<Error>();
  const [busy, setBusy] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [cause, setCause] = useState<CauseDraft | null>(null);
  const [lesson, setLesson] = useState({
    type: "LESSON" as PostmortemLessonType,
    title: "",
    description: "",
    category: "" as PostmortemCauseCategory | "",
  });
  const [action, setAction] = useState({
    title: "",
    priority: "MEDIUM",
    ownerUserId: "",
    dueAt: "",
    taskId: "",
  });
  const [entry, setEntry] = useState({ occurredAt: "", title: "", description: "" });
  const [review, setReview] = useState({ decision: "APPROVED", comment: "" });

  const detail = useAsync(() => postmortemsService.detail(id), [id]);
  const references = useAsync(postmortemsService.references, []);

  const run = async (operation: () => Promise<unknown>) => {
    setBusy(true);
    setError(undefined);
    try {
      await operation();
      detail.reload();
    } catch (cause_) {
      setError(
        cause_ instanceof Error ? cause_ : new Error("Operação não concluída."),
      );
    } finally {
      setBusy(false);
    }
  };

  if (detail.loading) return <Loading label="Carregando análise…" />;
  if (detail.error) return <ErrorState error={detail.error} onRetry={detail.reload} />;
  if (!detail.data)
    return (
      <EmptyState
        title="Análise não encontrada"
        description="O registro pode ter sido removido."
        action={<LinkButton to="/postmortems">Voltar</LinkButton>}
      />
    );

  const record = detail.data;
  const actions = new Set(record.availableActions);
  const canEdit = actions.has("edit");

  const saveSummary = async () => {
    const payload = Object.fromEntries(
      Object.entries(drafts).map(([key, value]) => [key, value]),
    );
    await run(async () => {
      await postmortemsService.update(record.id, payload);
      setDrafts({});
    });
  };

  const saveCause = async () => {
    if (!cause) return;
    await run(async () => {
      const payload = {
        type: cause.type,
        category: cause.category,
        statement: cause.statement,
        evidence: cause.evidence || undefined,
        parentId: cause.parentId || undefined,
      };
      if (cause.id)
        await postmortemsService.updateCause(record.id, cause.id, payload);
      else await postmortemsService.addCause(record.id, payload);
      setCause(null);
    });
  };

  return (
    <section className={styles.page}>
      <Breadcrumb
        items={[
          { label: "Postmortem", to: "/postmortems/dashboard" },
          { label: record.code },
        ]}
      />
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>{record.code}</span>
          <h1>{record.title}</h1>
          <div className={styles.headerActions} style={{ marginTop: 8 }}>
            <PostmortemStatusPill status={record.status} />
            <SeverityBadge severity={record.primaryIncident.severity} />
          </div>
          <p style={{ marginTop: 10 }}>
            Incidente primário{" "}
            <Link to={`/incidents/${record.primaryIncident.id}`}>
              {record.primaryIncident.code}
            </Link>{" "}
            · {record.primaryIncident.title}
          </p>
        </div>
        <div className={styles.headerActions}>
          <LinkButton secondary to="/postmortems/dashboard">
            Painel
          </LinkButton>
          {actions.has("submitForReview") && (
            <Button
              onClick={() =>
                void run(() => postmortemsService.submitForReview(record.id))
              }
              disabled={busy}
            >
              Enviar para review
            </Button>
          )}
          {actions.has("publish") && (
            <Button
              onClick={() => void run(() => postmortemsService.publish(record.id))}
              disabled={busy}
            >
              Publicar
            </Button>
          )}
          {actions.has("archive") && (
            <Button
              secondary
              onClick={() => void run(() => postmortemsService.archive(record.id))}
              disabled={busy}
            >
              Arquivar
            </Button>
          )}
        </div>
      </header>

      {error && <ErrorState error={error} />}
      {record.status === "CHANGES_REQUESTED" && (
        <Card>
          <strong>Ajustes solicitados na revisão.</strong>
          <p className={styles.muted}>
            {record.reviews.find((item) => item.decision === "CHANGES_REQUESTED")
              ?.comment ?? "Consulte a aba de review."}
          </p>
        </Card>
      )}

      <nav className={styles.tabs}>
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`${styles.tab} ${tab === item.id ? styles.tabActive : ""}`}
            aria-current={tab === item.id ? "page" : undefined}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className={styles.layout}>
        <div className={styles.stack}>
          {tab === "summary" && (
            <Card>
              <div className={styles.sectionTitle}>
                <h2>Resumo estruturado</h2>
                {canEdit && (
                  <Button
                    onClick={() => void saveSummary()}
                    disabled={busy || Object.keys(drafts).length === 0}
                  >
                    Salvar seções
                  </Button>
                )}
              </div>
              <div className={styles.form} style={{ marginTop: 12 }}>
                {SUMMARY_FIELDS.map((field) => (
                  <Field key={field.key} label={field.label}>
                    <textarea
                      value={drafts[field.key] ?? record[field.key] ?? ""}
                      disabled={!canEdit}
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [field.key]: event.target.value,
                        }))
                      }
                    />
                  </Field>
                ))}
              </div>
            </Card>
          )}

          {tab === "causes" && (
            <Card>
              <div className={styles.sectionTitle}>
                <h2>Análise causal</h2>
                {canEdit && (
                  <Button
                    onClick={() =>
                      setCause({
                        parentId: "",
                        type: "ROOT_CAUSE",
                        category: "PROCESS",
                        statement: "",
                        evidence: "",
                      })
                    }
                  >
                    Nova causa raiz
                  </Button>
                )}
              </div>
              <CauseTree
                causes={record.causes}
                canEdit={canEdit}
                onAddChild={(parentId) =>
                  setCause({
                    parentId,
                    type: "CONTRIBUTING_FACTOR",
                    category: "PROCESS",
                    statement: "",
                    evidence: "",
                  })
                }
                onEdit={(item: PostmortemCause) =>
                  setCause({
                    id: item.id,
                    parentId: item.parentId ?? "",
                    type: item.type,
                    category: item.category,
                    statement: item.statement,
                    evidence: item.evidence ?? "",
                  })
                }
                onRemove={(item) =>
                  void run(() => postmortemsService.removeCause(record.id, item.id))
                }
              />
              {cause && (
                <div className={styles.form} style={{ marginTop: 16 }}>
                  <div className={styles.formGrid}>
                    <Field label="Tipo">
                      <Select
                        value={cause.type}
                        onChange={(event) =>
                          setCause({
                            ...cause,
                            type: event.target.value as PostmortemCauseType,
                          })
                        }
                      >
                        {CAUSE_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {POSTMORTEM_CAUSE_TYPE_LABELS[type]}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Categoria">
                      <Select
                        value={cause.category}
                        onChange={(event) =>
                          setCause({
                            ...cause,
                            category: event.target.value as PostmortemCauseCategory,
                          })
                        }
                      >
                        {CAUSE_CATEGORIES.map((category) => (
                          <option key={category} value={category}>
                            {POSTMORTEM_CAUSE_CATEGORY_LABELS[category]}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Causa superior (5 Whys)">
                      <Select
                        value={cause.parentId}
                        onChange={(event) =>
                          setCause({ ...cause, parentId: event.target.value })
                        }
                      >
                        <option value="">Nenhuma (raiz)</option>
                        {record.causes
                          .filter((item) => item.id !== cause.id)
                          .map((item) => (
                            <option key={item.id} value={item.id}>
                              {POSTMORTEM_CAUSE_TYPE_LABELS[item.type]} ·{" "}
                              {item.statement.slice(0, 60)}
                            </option>
                          ))}
                      </Select>
                    </Field>
                  </div>
                  <Field label="Declaração">
                    <Input
                      value={cause.statement}
                      maxLength={2000}
                      onChange={(event) =>
                        setCause({ ...cause, statement: event.target.value })
                      }
                    />
                  </Field>
                  <Field label="Evidência">
                    <Input
                      value={cause.evidence}
                      maxLength={4000}
                      onChange={(event) =>
                        setCause({ ...cause, evidence: event.target.value })
                      }
                    />
                  </Field>
                  <div className={styles.rowActions}>
                    <Button
                      onClick={() => void saveCause()}
                      disabled={busy || cause.statement.trim().length < 3}
                    >
                      {cause.id ? "Salvar causa" : "Adicionar causa"}
                    </Button>
                    <Button secondary onClick={() => setCause(null)}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          )}

          {tab === "lessons" && (
            <Card>
              <div className={styles.sectionTitle}>
                <h2>Lições aprendidas</h2>
                <span className={styles.muted}>
                  {record.lessons.length} registro(s)
                </span>
              </div>
              <ul className={styles.cardList}>
                {record.lessons.map((item: PostmortemLesson) => (
                  <li key={item.id} className={styles.cardItem}>
                    <header>
                      <h3>{item.title}</h3>
                      <span className={styles.muted}>
                        {POSTMORTEM_LESSON_TYPE_LABELS[item.type]}
                        {item.category
                          ? ` · ${POSTMORTEM_CAUSE_CATEGORY_LABELS[item.category]}`
                          : ""}
                      </span>
                    </header>
                    <p>{item.description}</p>
                    {canEdit && (
                      <div className={styles.causeActions}>
                        <Button
                          secondary
                          onClick={() =>
                            void run(() =>
                              postmortemsService.removeLesson(record.id, item.id),
                            )
                          }
                        >
                          Remover
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
                {record.lessons.length === 0 && (
                  <p className={styles.muted}>Nenhuma lição registrada.</p>
                )}
              </ul>
              {canEdit && (
                <div className={styles.form} style={{ marginTop: 16 }}>
                  <div className={styles.formGrid}>
                    <Field label="Tipo">
                      <Select
                        value={lesson.type}
                        onChange={(event) =>
                          setLesson({
                            ...lesson,
                            type: event.target.value as PostmortemLessonType,
                          })
                        }
                      >
                        {LESSON_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {POSTMORTEM_LESSON_TYPE_LABELS[type]}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Categoria">
                      <Select
                        value={lesson.category}
                        onChange={(event) =>
                          setLesson({
                            ...lesson,
                            category: event.target
                              .value as PostmortemCauseCategory | "",
                          })
                        }
                      >
                        <option value="">Não classificada</option>
                        {CAUSE_CATEGORIES.map((category) => (
                          <option key={category} value={category}>
                            {POSTMORTEM_CAUSE_CATEGORY_LABELS[category]}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  </div>
                  <Field label="Título">
                    <Input
                      value={lesson.title}
                      maxLength={200}
                      onChange={(event) =>
                        setLesson({ ...lesson, title: event.target.value })
                      }
                    />
                  </Field>
                  <Field label="Descrição">
                    <Input
                      value={lesson.description}
                      maxLength={4000}
                      onChange={(event) =>
                        setLesson({ ...lesson, description: event.target.value })
                      }
                    />
                  </Field>
                  <Button
                    onClick={() =>
                      void run(async () => {
                        await postmortemsService.addLesson(record.id, {
                          type: lesson.type,
                          title: lesson.title,
                          description: lesson.description,
                          category: lesson.category || undefined,
                        });
                        setLesson({
                          type: "LESSON",
                          title: "",
                          description: "",
                          category: "",
                        });
                      })
                    }
                    disabled={
                      busy ||
                      lesson.title.trim().length < 3 ||
                      lesson.description.trim().length < 3
                    }
                  >
                    Registrar lição
                  </Button>
                </div>
              )}
            </Card>
          )}

          {tab === "actions" && (
            <Card>
              <div className={styles.sectionTitle}>
                <h2>Ações corretivas</h2>
                <span className={styles.muted}>
                  {record.actions.filter((item) => item.overdue).length} vencida(s)
                </span>
              </div>
              <div className={styles.tableWrap} style={{ marginTop: 12 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Ação</th>
                      <th>Responsável</th>
                      <th>Prioridade</th>
                      <th>Prazo</th>
                      <th>Status</th>
                      <th>Tarefa</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {record.actions.map((item: PostmortemActionItem) => (
                      <tr key={item.id}>
                        <td>
                          <strong>{item.title}</strong>
                          {item.description && <small>{item.description}</small>}
                        </td>
                        <td>{item.ownerUser?.name ?? "Não atribuída"}</td>
                        <td>
                          <PriorityBadge priority={item.priority} />
                        </td>
                        <td className={item.overdue ? styles.overdue : ""}>
                          {item.dueAt ? formatDateTime(item.dueAt) : "—"}
                        </td>
                        <td>
                          <Select
                            aria-label={`Status da ação ${item.title}`}
                            value={item.status}
                            disabled={busy}
                            onChange={(event) =>
                              void run(() =>
                                postmortemsService.updateAction(
                                  record.id,
                                  item.id,
                                  { status: event.target.value },
                                ),
                              )
                            }
                          >
                            {(
                              Object.keys(
                                POSTMORTEM_ACTION_STATUS_LABELS,
                              ) as Array<keyof typeof POSTMORTEM_ACTION_STATUS_LABELS>
                            ).map((status) => (
                              <option key={status} value={status}>
                                {POSTMORTEM_ACTION_STATUS_LABELS[status]}
                              </option>
                            ))}
                          </Select>
                        </td>
                        <td>
                          {item.task ? (
                            <Link to={`/tasks/${item.task.id}`}>
                              {item.task.title}
                            </Link>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td>
                          {canEdit && (
                            <Button
                              secondary
                              onClick={() =>
                                void run(() =>
                                  postmortemsService.removeAction(record.id, item.id),
                                )
                              }
                            >
                              Remover
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {record.actions.length === 0 && (
                      <tr>
                        <td colSpan={7} className={styles.muted}>
                          Nenhuma ação corretiva registrada.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {canEdit && (
                <div className={styles.form} style={{ marginTop: 16 }}>
                  <div className={styles.formGrid}>
                    <Field label="Título">
                      <Input
                        value={action.title}
                        maxLength={200}
                        onChange={(event) =>
                          setAction({ ...action, title: event.target.value })
                        }
                      />
                    </Field>
                    <Field label="Prioridade">
                      <Select
                        value={action.priority}
                        onChange={(event) =>
                          setAction({ ...action, priority: event.target.value })
                        }
                      >
                        {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((value) => (
                          <option key={value} value={value}>
                            {value}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Responsável">
                      <Select
                        value={action.ownerUserId}
                        onChange={(event) =>
                          setAction({ ...action, ownerUserId: event.target.value })
                        }
                      >
                        <option value="">Não atribuída</option>
                        {(references.data?.users ?? []).map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.name}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Prazo">
                      <Input
                        type="datetime-local"
                        value={action.dueAt}
                        onChange={(event) =>
                          setAction({ ...action, dueAt: event.target.value })
                        }
                      />
                    </Field>
                    <Field label="Vincular tarefa existente">
                      <Select
                        value={action.taskId}
                        onChange={(event) =>
                          setAction({ ...action, taskId: event.target.value })
                        }
                      >
                        <option value="">Sem vínculo</option>
                        {(references.data?.tasks ?? [])
                          .filter(
                            (task) => task.electionId === record.primaryIncident.electionId,
                          )
                          .map((task) => (
                            <option key={task.id} value={task.id}>
                              {task.title}
                            </option>
                          ))}
                      </Select>
                    </Field>
                  </div>
                  <p className={styles.muted}>
                    O vínculo referencia uma tarefa já existente; nenhuma tarefa é
                    criada automaticamente.
                  </p>
                  <Button
                    onClick={() =>
                      void run(async () => {
                        await postmortemsService.addAction(record.id, {
                          title: action.title,
                          priority: action.priority,
                          ownerUserId: action.ownerUserId || undefined,
                          dueAt: action.dueAt
                            ? new Date(action.dueAt).toISOString()
                            : undefined,
                          taskId: action.taskId || undefined,
                        });
                        setAction({
                          title: "",
                          priority: "MEDIUM",
                          ownerUserId: "",
                          dueAt: "",
                          taskId: "",
                        });
                      })
                    }
                    disabled={busy || action.title.trim().length < 3}
                  >
                    Adicionar ação
                  </Button>
                </div>
              )}
            </Card>
          )}

          {tab === "timeline" && (
            <Card>
              <div className={styles.sectionTitle}>
                <h2>Timeline operacional</h2>
                <span className={styles.muted}>
                  {record.timeline.filter((item) => item.imported).length}{" "}
                  importada(s)
                </span>
              </div>
              {canEdit && (
                <div className={styles.rowActions} style={{ marginTop: 12 }}>
                  <Button
                    onClick={() =>
                      void run(() =>
                        postmortemsService.importTimeline(record.id, {
                          includeIncidentEvents: true,
                          includeTasks: true,
                        }),
                      )
                    }
                    disabled={busy}
                  >
                    Importar timeline
                  </Button>
                </div>
              )}
              <ul className={styles.timeline}>
                {record.timeline.map((item) => (
                  <li key={item.id}>
                    <time>{formatDateTime(item.occurredAt)}</time>
                    <div>
                      <strong>{item.title}</strong>
                      {item.description && <p>{item.description}</p>}
                      <div className={styles.timelineTags}>
                        <span
                          className={`${styles.tag} ${
                            item.imported ? styles.tagImported : styles.tagManual
                          }`}
                        >
                          {item.imported ? "importada" : "manual"}
                        </span>
                        <span className={styles.tag}>{item.sourceType}</span>
                      </div>
                    </div>
                  </li>
                ))}
                {record.timeline.length === 0 && (
                  <p className={styles.muted}>
                    Nenhuma entrada de timeline registrada.
                  </p>
                )}
              </ul>
              {canEdit && (
                <div className={styles.form} style={{ marginTop: 16 }}>
                  <div className={styles.formGrid}>
                    <Field label="Momento">
                      <Input
                        type="datetime-local"
                        value={entry.occurredAt}
                        onChange={(event) =>
                          setEntry({ ...entry, occurredAt: event.target.value })
                        }
                      />
                    </Field>
                    <Field label="Título">
                      <Input
                        value={entry.title}
                        maxLength={200}
                        onChange={(event) =>
                          setEntry({ ...entry, title: event.target.value })
                        }
                      />
                    </Field>
                  </div>
                  <Field label="Descrição">
                    <Input
                      value={entry.description}
                      maxLength={4000}
                      onChange={(event) =>
                        setEntry({ ...entry, description: event.target.value })
                      }
                    />
                  </Field>
                  <Button
                    secondary
                    onClick={() =>
                      void run(async () => {
                        await postmortemsService.addTimelineEntry(record.id, {
                          occurredAt: new Date(entry.occurredAt).toISOString(),
                          title: entry.title,
                          description: entry.description || undefined,
                        });
                        setEntry({ occurredAt: "", title: "", description: "" });
                      })
                    }
                    disabled={
                      busy ||
                      !entry.occurredAt ||
                      entry.title.trim().length < 3
                    }
                  >
                    Adicionar entrada manual
                  </Button>
                </div>
              )}
            </Card>
          )}

          {tab === "review" && (
            <Card>
              <div className={styles.sectionTitle}>
                <h2>Review</h2>
                <span className={styles.muted}>
                  {record.approval.pendingReviewerIds.length} revisor(es) pendente(s)
                </span>
              </div>
              <ul className={styles.cardList}>
                {record.reviewers.map((item) => {
                  const latest = record.reviews.find(
                    (review_) => review_.reviewer.id === item.userId,
                  );
                  return (
                    <li key={item.id} className={styles.cardItem}>
                      <header>
                        <h3>{item.user.name}</h3>
                        <span className={styles.muted}>
                          {record.approval.pendingReviewerIds.includes(item.userId)
                            ? "pendente"
                            : latest?.decision}
                        </span>
                      </header>
                    </li>
                  );
                })}
                {record.reviewers.length === 0 && (
                  <p className={styles.muted}>Nenhum revisor designado.</p>
                )}
              </ul>

              {canEdit && (
                <div className={styles.form} style={{ marginTop: 16 }}>
                  <Field label="Revisores designados">
                    <Select
                      multiple
                      value={record.reviewers.map((item) => item.userId)}
                      onChange={(event) =>
                        void run(() =>
                          postmortemsService.setReviewers(
                            record.id,
                            [...event.target.selectedOptions].map(
                              (option) => option.value,
                            ),
                          ),
                        )
                      }
                    >
                      {(references.data?.users ?? []).map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <p className={styles.muted}>
                    A aprovação exige que todos os revisores designados registrem
                    decisão de aprovação. Qualquer pedido de mudança devolve a
                    análise para ajustes.
                  </p>
                </div>
              )}

              <ul className={styles.reviewList}>
                {record.reviews.map((item) => (
                  <li key={item.id}>
                    <header>
                      <strong>{item.reviewer.name}</strong>
                      <time>{formatDateTime(item.createdAt)}</time>
                    </header>
                    <p>
                      {item.decision === "APPROVED"
                        ? "Aprovado"
                        : "Mudanças solicitadas"}
                      {item.comment ? ` · ${item.comment}` : ""}
                    </p>
                  </li>
                ))}
                {record.reviews.length === 0 && (
                  <p className={styles.muted}>Nenhuma decisão registrada.</p>
                )}
              </ul>

              {actions.has("review") && (
                <div className={styles.form} style={{ marginTop: 16 }}>
                  <Field label="Sua decisão">
                    <Select
                      value={review.decision}
                      onChange={(event) =>
                        setReview({ ...review, decision: event.target.value })
                      }
                    >
                      <option value="APPROVED">Aprovar</option>
                      <option value="CHANGES_REQUESTED">
                        Solicitar mudanças
                      </option>
                    </Select>
                  </Field>
                  <Field label="Comentário">
                    <Input
                      value={review.comment}
                      maxLength={4000}
                      onChange={(event) =>
                        setReview({ ...review, comment: event.target.value })
                      }
                    />
                  </Field>
                  <Button
                    onClick={() =>
                      void run(() =>
                        postmortemsService.review(
                          record.id,
                          review.decision,
                          review.comment || undefined,
                        ),
                      )
                    }
                    disabled={
                      busy ||
                      (review.decision === "CHANGES_REQUESTED" &&
                        review.comment.trim().length === 0)
                    }
                  >
                    Registrar decisão
                  </Button>
                </div>
              )}
            </Card>
          )}
        </div>

        <div className={styles.stack}>
          <Card>
            <div className={styles.sectionTitle}>
              <h2>Situação</h2>
            </div>
            <dl className={styles.definitionGrid}>
              <dt>Responsável</dt>
              <dd>{record.owner?.name ?? "—"}</dd>
              <dt>Criado por</dt>
              <dd>{record.createdBy.name}</dd>
              <dt>Criado em</dt>
              <dd>{formatDateTime(record.createdAt)}</dd>
              <dt>Enviado ao review</dt>
              <dd>
                {record.submittedForReviewAt
                  ? formatDateTime(record.submittedForReviewAt)
                  : "—"}
              </dd>
              <dt>Aprovado em</dt>
              <dd>
                {record.approvedAt ? formatDateTime(record.approvedAt) : "—"}
              </dd>
              <dt>Publicado em</dt>
              <dd>
                {record.publishedAt ? formatDateTime(record.publishedAt) : "—"}
              </dd>
              <dt>Arquivado em</dt>
              <dd>
                {record.archivedAt ? formatDateTime(record.archivedAt) : "—"}
              </dd>
            </dl>
          </Card>

          <Card>
            <div className={styles.sectionTitle}>
              <h2>Incidentes relacionados</h2>
              <Link to={`/postmortems/${record.id}/timeline`}>Timeline</Link>
            </div>
            <ul className={styles.cardList}>
              {record.relatedIncidents.map((item) => (
                <li key={item.incident.id} className={styles.cardItem}>
                  <Link to={`/incidents/${item.incident.id}`}>
                    {item.incident.code}
                  </Link>
                  <p>{item.incident.title}</p>
                </li>
              ))}
              {record.relatedIncidents.length === 0 && (
                <p className={styles.muted}>Nenhum incidente relacionado.</p>
              )}
            </ul>
            {canEdit && (
              <div className={styles.form} style={{ marginTop: 12 }}>
                <Field label="Vincular incidentes">
                  <Select
                    multiple
                    value={record.relatedIncidents.map((item) => item.incident.id)}
                    onChange={(event) =>
                      void run(() =>
                        postmortemsService.setRelatedIncidents(
                          record.id,
                          [...event.target.selectedOptions].map(
                            (option) => option.value,
                          ),
                        ),
                      )
                    }
                  >
                    {(references.data?.incidents ?? [])
                      .filter(
                        (incident) =>
                          incident.id !== record.primaryIncidentId,
                      )
                      .map((incident) => (
                        <option key={incident.id} value={incident.id}>
                          {incident.code} · {incident.title}
                        </option>
                      ))}
                  </Select>
                </Field>
              </div>
            )}
          </Card>

          {record.publishedAt && (
            <Card>
              <p className={styles.muted}>
                Publicado. A integração automática com o módulo de conhecimento
                não é executada — crie o artigo manualmente se fizer sentido.
              </p>
              <LinkButton secondary to="/knowledge">
                Abrir base de conhecimento
              </LinkButton>
            </Card>
          )}
        </div>
      </div>
    </section>
  );
}
