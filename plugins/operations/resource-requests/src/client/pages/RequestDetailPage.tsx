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
  RESOURCE_REQUEST_ITEM_KIND_LABELS,
  RESOURCE_REQUEST_PRIORITIES,
  RESOURCE_REQUEST_PRIORITY_LABELS,
  type ResourceRequestPriority,
} from "@eops/shared/resource-requests";
import { Link, useNavigate, useParams } from "react-router-dom";
import { FulfillmentPanel } from "../components/FulfillmentPanel";
import {
  PriorityBadge,
  StatusBadge,
  UrgencyBadge,
} from "../components/RequestBadges";
import { resourceRequestsService } from "../services/resourceRequestsService";
import styles from "../styles/resource-requests.module.css";

type Tab = "summary" | "items" | "fulfillment" | "comments" | "timeline";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "summary", label: "Resumo" },
  { id: "items", label: "Itens" },
  { id: "fulfillment", label: "Atendimento" },
  { id: "comments", label: "Comentários" },
  { id: "timeline", label: "Histórico" },
];

export function RequestDetailPage() {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("summary");
  const [error, setError] = useState<Error>();
  const [busy, setBusy] = useState(false);
  const [triage, setTriage] = useState({
    ownerId: "",
    priority: "" as ResourceRequestPriority | "",
    notes: "",
  });
  const [reasons, setReasons] = useState({ reject: "", cancel: "" });
  const [comment, setComment] = useState("");

  const detail = useAsync(
    () => resourceRequestsService.detail(id),
    [id],
  );
  const references = useAsync(
    () => resourceRequestsService.references(detail.data?.electionId),
    [detail.data?.electionId],
  );

  const run = async (operation: () => Promise<unknown>) => {
    setBusy(true);
    setError(undefined);
    try {
      await operation();
      detail.reload();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause : new Error("Operação não concluída."),
      );
    } finally {
      setBusy(false);
    }
  };

  if (detail.loading) return <Loading label="Carregando solicitação…" />;
  if (detail.error)
    return <ErrorState error={detail.error} onRetry={detail.reload} />;
  if (!detail.data)
    return (
      <EmptyState
        title="Solicitação não encontrada"
        description="O registro pode ter sido removido ou o identificador é inválido."
        action={<LinkButton to="/resource-requests">Voltar</LinkButton>}
      />
    );

  const record = detail.data;
  const actions = new Set(record.availableActions);

  return (
    <section className={styles.page}>
      <Breadcrumb
        items={[
          { label: "Solicitações de recurso", to: "/resource-requests" },
          { label: record.code },
        ]}
      />
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>{record.code}</span>
          <h1>{record.title}</h1>
          <div className={styles.queueTags} style={{ marginTop: 8 }}>
            <PriorityBadge priority={record.priority} />
            <StatusBadge status={record.status} />
            <UrgencyBadge urgency={record.urgency} />
          </div>
        </div>
        <div className={styles.headerActions}>
          <LinkButton secondary to="/resource-requests/queue">
            Fila operacional
          </LinkButton>
          {actions.has("edit") && (
            <LinkButton to={`/resource-requests/${record.id}/edit`}>
              Editar rascunho
            </LinkButton>
          )}
        </div>
      </header>

      {error && <ErrorState error={error} />}

      <nav className={styles.queueTags} style={{ marginBottom: 16 }}>
        {TABS.map((entry) => (
          <Button
            key={entry.id}
            secondary={tab !== entry.id}
            aria-current={tab === entry.id ? "page" : undefined}
            onClick={() => setTab(entry.id)}
          >
            {entry.label}
          </Button>
        ))}
      </nav>

      <div className={styles.detailGrid}>
        <div className={styles.stack}>
          {tab === "summary" && (
            <Card>
              <div className={styles.sectionTitle}>
                <h2>Resumo</h2>
              </div>
              <p>{record.description}</p>
              <dl className={styles.definitionGrid}>
                <dt>Pleito</dt>
                <dd>{record.election.name}</dd>
                <dt>Zona</dt>
                <dd>{record.electoralZone?.name ?? "Não informada"}</dd>
                <dt>Local</dt>
                <dd>{record.pollingPlace?.name ?? "Não informado"}</dd>
                <dt>Solicitante</dt>
                <dd>{record.requestedBy.name}</dd>
                <dt>Responsável</dt>
                <dd>{record.owner?.name ?? "Sem responsável"}</dd>
                <dt>Necessário até</dt>
                <dd>
                  {record.neededAt ? formatDateTime(record.neededAt) : "Sem prazo"}
                </dd>
                <dt>Criada em</dt>
                <dd>{formatDateTime(record.createdAt)}</dd>
                <dt>Submetida em</dt>
                <dd>
                  {record.submittedAt
                    ? formatDateTime(record.submittedAt)
                    : "Não submetida"}
                </dd>
                <dt>Aprovada em</dt>
                <dd>
                  {record.approvedAt
                    ? formatDateTime(record.approvedAt)
                    : "Não aprovada"}
                </dd>
                <dt>Atendida em</dt>
                <dd>
                  {record.fulfilledAt
                    ? formatDateTime(record.fulfilledAt)
                    : "Em andamento"}
                </dd>
                {record.incident && (
                  <>
                    <dt>Incidente</dt>
                    <dd>
                      <Link to={`/incidents/${record.incident.id}`}>
                        {record.incident.code} · {record.incident.title}
                      </Link>
                    </dd>
                  </>
                )}
                {record.rejectionReason && (
                  <>
                    <dt>Motivo da rejeição</dt>
                    <dd>{record.rejectionReason}</dd>
                  </>
                )}
                {record.cancellationReason && (
                  <>
                    <dt>Motivo do cancelamento</dt>
                    <dd>{record.cancellationReason}</dd>
                  </>
                )}
                {record.triageNotes && (
                  <>
                    <dt>Notas de triagem</dt>
                    <dd>{record.triageNotes}</dd>
                  </>
                )}
              </dl>
            </Card>
          )}

          {tab === "items" && (
            <Card>
              <div className={styles.sectionTitle}>
                <h2>Itens solicitados</h2>
                <span className={styles.muted}>{record.items.length} item(ns)</span>
              </div>
              <ul className={styles.cardList}>
                {record.items.map((item) => (
                  <li key={item.id} className={styles.itemCard}>
                    <div className={styles.itemHeader}>
                      <h3>{item.label}</h3>
                      <span className={styles.muted}>
                        {RESOURCE_REQUEST_ITEM_KIND_LABELS[item.kind]}
                      </span>
                    </div>
                    <p>
                      Necessário {item.quantity} · atendido {item.fulfilledQuantity} ·
                      pendente {item.remainingQuantity}
                    </p>
                    {item.assetType && <p>Tipo de ativo: {item.assetType.name}</p>}
                    {item.fieldTeam && (
                      <p>
                        Equipe: {item.fieldTeam.code} · {item.fieldTeam.name}
                      </p>
                    )}
                    {item.vehicle && (
                      <p>
                        Veículo: {item.vehicle.identification} · {item.vehicle.plate}
                      </p>
                    )}
                    {item.description && <p>{item.description}</p>}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {tab === "fulfillment" && (
            <Card>
              <FulfillmentPanel
                request={record}
                canFulfill={actions.has("addFulfillment")}
                onAdd={async (input) => {
                  await run(() =>
                    resourceRequestsService.addFulfillment(record.id, input),
                  );
                }}
                onRemove={async (fulfillmentId) => {
                  await run(() =>
                    resourceRequestsService.removeFulfillment(
                      record.id,
                      fulfillmentId,
                    ),
                  );
                }}
              />
            </Card>
          )}

          {tab === "comments" && (
            <Card>
              <div className={styles.sectionTitle}>
                <h2>Comentários</h2>
              </div>
              {record.comments.length === 0 ? (
                <p className={styles.muted}>Nenhum comentário registrado.</p>
              ) : (
                <ul className={styles.commentList}>
                  {record.comments.map((entry) => (
                    <li key={entry.id}>
                      <header>
                        <strong>{entry.author.name}</strong>
                        <time>{formatDateTime(entry.createdAt)}</time>
                      </header>
                      <p>{entry.body}</p>
                    </li>
                  ))}
                </ul>
              )}
              {actions.has("addComment") && (
                <div className={styles.commentForm}>
                  <Field label="Novo comentário">
                    <Input
                      value={comment}
                      maxLength={4000}
                      onChange={(event) => setComment(event.target.value)}
                    />
                  </Field>
                  <Button
                    onClick={() =>
                      void run(async () => {
                        await resourceRequestsService.addComment(
                          record.id,
                          comment,
                        );
                        setComment("");
                      })
                    }
                    disabled={busy || comment.trim().length === 0}
                  >
                    Comentar
                  </Button>
                </div>
              )}
            </Card>
          )}

          {tab === "timeline" && (
            <Card>
              <div className={styles.sectionTitle}>
                <h2>Histórico</h2>
              </div>
              <ul className={styles.timeline}>
                {record.history.map((entry) => (
                  <li key={entry.id}>
                    <time>{formatDateTime(entry.createdAt)}</time>
                    <div>
                      <strong>{entry.action}</strong>
                      <p>
                        {entry.description}
                        {entry.actor ? ` · ${entry.actor.name}` : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <div className={styles.stack}>
          <Card>
            <div className={styles.sectionTitle}>
              <h2>Ações disponíveis</h2>
            </div>
            <div className={styles.actionList}>
              {actions.has("submit") && (
                <Button
                  onClick={() =>
                    void run(() => resourceRequestsService.submit(record.id))
                  }
                  disabled={busy}
                >
                  Submeter para triagem
                </Button>
              )}
              {actions.has("approve") && (
                <Button
                  onClick={() =>
                    void run(() => resourceRequestsService.approve(record.id))
                  }
                  disabled={busy}
                >
                  Aprovar
                </Button>
              )}
              {actions.has("cancel") && (
                <>
                  <Field label="Motivo do cancelamento">
                    <Input
                      value={reasons.cancel}
                      onChange={(event) =>
                        setReasons((current) => ({
                          ...current,
                          cancel: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Button
                    secondary
                    onClick={() =>
                      void run(() =>
                        resourceRequestsService.cancel(
                          record.id,
                          reasons.cancel || undefined,
                        ),
                      )
                    }
                    disabled={busy}
                  >
                    Cancelar solicitação
                  </Button>
                </>
              )}
              {record.availableActions.length === 0 && (
                <p className={styles.muted}>
                  Nenhuma ação disponível para o seu perfil neste estado.
                </p>
              )}
            </div>
          </Card>

          {actions.has("triage") && (
            <Card>
              <div className={styles.sectionTitle}>
                <h2>Triagem</h2>
              </div>
              <div className={styles.commentForm}>
                <Field label="Responsável">
                  <Select
                    value={triage.ownerId}
                    onChange={(event) =>
                      setTriage((current) => ({
                        ...current,
                        ownerId: event.target.value,
                      }))
                    }
                  >
                    <option value="">Manter atual</option>
                    {(references.data?.users ?? []).map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Prioridade">
                  <Select
                    value={triage.priority}
                    onChange={(event) =>
                      setTriage((current) => ({
                        ...current,
                        priority: event.target.value as ResourceRequestPriority | "",
                      }))
                    }
                  >
                    <option value="">Manter atual</option>
                    {RESOURCE_REQUEST_PRIORITIES.map((priority) => (
                      <option key={priority} value={priority}>
                        {RESOURCE_REQUEST_PRIORITY_LABELS[priority]}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Notas">
                  <Input
                    value={triage.notes}
                    onChange={(event) =>
                      setTriage((current) => ({
                        ...current,
                        notes: event.target.value,
                      }))
                    }
                  />
                </Field>
                <Button
                  onClick={() =>
                    void run(() =>
                      resourceRequestsService.triage(record.id, {
                        ownerId: triage.ownerId || undefined,
                        priority: triage.priority || undefined,
                        notes: triage.notes || undefined,
                      }),
                    )
                  }
                  disabled={busy}
                >
                  Registrar triagem
                </Button>
              </div>
            </Card>
          )}

          {actions.has("reject") && (
            <Card>
              <div className={styles.sectionTitle}>
                <h2>Rejeição</h2>
              </div>
              <div className={styles.commentForm}>
                <Field label="Motivo">
                  <Input
                    value={reasons.reject}
                    onChange={(event) =>
                      setReasons((current) => ({
                        ...current,
                        reject: event.target.value,
                      }))
                    }
                  />
                </Field>
                <Button
                  secondary
                  onClick={() =>
                    void run(() =>
                      resourceRequestsService.reject(record.id, reasons.reject),
                    )
                  }
                  disabled={busy || reasons.reject.trim().length < 3}
                >
                  Rejeitar solicitação
                </Button>
              </div>
            </Card>
          )}

          <Card>
            <div className={styles.sectionTitle}>
              <h2>Contexto relacionado</h2>
            </div>
            <ul className={styles.cardList}>
              {record.task && (
                <li>
                  <span>Tarefa</span>
                  <Link to={`/tasks/${record.task.id}`}>{record.task.title}</Link>
                </li>
              )}
              {record.incident && (
                <li>
                  <span>Incidente</span>
                  <Link to={`/incidents/${record.incident.id}`}>
                    {record.incident.code}
                  </Link>
                </li>
              )}
              <li>
                <span>Zona eleitoral</span>
                {record.electoralZone ? (
                  <Link to={`/electoral-zones/${record.electoralZone.id}`}>
                    {record.electoralZone.name}
                  </Link>
                ) : (
                  <span className={styles.muted}>Não informada</span>
                )}
              </li>
              <li>
                <span>Atendimento</span>
                <strong>
                  {record.totals.totalFulfilled}/{record.totals.totalRequired}
                </strong>
              </li>
            </ul>
          </Card>

          <Button secondary onClick={() => navigate("/resource-requests/queue")}>
            Voltar para a fila
          </Button>
        </div>
      </div>
    </section>
  );
}
