import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Button,
  Card,
  ErrorState,
  Field,
  Input,
  LinkButton,
  Loading,
  useAsync,
} from "@eops/ui";
import { formatDateTime } from "@eops/shared/format";
import { PriorityBadge, StatusBadge } from "../components/CommunicationBadges";
import { MetricGrid } from "../components/MetricBar";
import { CommunicationTimeline } from "../components/CommunicationTimeline";
import { AudienceList } from "../components/AudienceEditor";
import { communicationService } from "../services/communicationService";
import { useMutation } from "../hooks/useCommunications";
import { describeExpiration } from "../utils/presentation";
import styles from "../styles/communications.module.css";

/**
 * Detalhe do comunicado: conteúdo, metadados, direcionamento, indicadores,
 * timeline e todas as ações de ciclo de vida.
 */
export function CommunicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [scheduledAt, setScheduledAt] = useState("");
  const [reason, setReason] = useState("");
  const [feedback, setFeedback] = useState<string>();

  const communication = useAsync(
    () => (id ? communicationService.get(id) : Promise.resolve(undefined)),
    [id ?? ""],
  );
  const references = useAsync(() => communicationService.referenceData(), []);

  const action = useMutation(
    async (operation: () => Promise<unknown>) => operation(),
    () => {
      communication.reload();
    },
  );

  if (communication.loading || references.loading) {
    return <Loading label="Carregando comunicado…" />;
  }
  if (communication.error || references.error) {
    return (
      <ErrorState
        error={communication.error ?? references.error}
        onRetry={communication.reload}
      />
    );
  }
  const data = communication.data;
  if (!data || !references.data) {
    return <ErrorState error={new Error("Comunicado não encontrado.")} />;
  }

  const run = (operation: () => Promise<unknown>, message: string) => {
    setFeedback(undefined);
    void action.run(operation).then((result) => {
      if (result !== undefined) setFeedback(message);
    });
  };

  const expiration = describeExpiration(data.expiresAt);

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>COMUNICAÇÃO {data.code}</span>
          <h1>{data.title}</h1>
          <div className={styles.badges}>
            <PriorityBadge priority={data.priority} />
            <StatusBadge status={data.status} />
            {expiration && (
              <span className={data.expired ? styles.dangerText : styles.mutedText}>
                {expiration}
              </span>
            )}
          </div>
        </div>
        <div className={styles.headerActions}>
          {["DRAFT", "SCHEDULED", "PUBLISHED"].includes(data.status) && (
            <LinkButton to={`/communications/messages/${data.id}/edit`} secondary>
              Editar
            </LinkButton>
          )}
          <LinkButton to={`/communications/messages/${data.id}/tracking`}>
            Acompanhamento
          </LinkButton>
        </div>
      </header>

      {action.error && <ErrorState error={action.error} />}
      {feedback && <p className={styles.successText}>{feedback}</p>}

      <div className={styles.detailGrid}>
        <Card>
          <h2>Conteúdo</h2>
          <p className={styles.content}>{data.content}</p>

          {data.observations && (
            <>
              <h3>Observações internas</h3>
              <p className={styles.mutedText}>{data.observations}</p>
            </>
          )}

          <h2>Direcionamento</h2>
          <AudienceList audiences={data.audiences} references={references.data} />

          {data.tags.length > 0 && (
            <>
              <h2>Etiquetas</h2>
              <div className={styles.tagList}>
                {data.tags.map((tag) => (
                  <span key={tag.id} className={styles.tag}>
                    {tag.label}
                  </span>
                ))}
              </div>
            </>
          )}
        </Card>

        <div className={styles.detailSide}>
          <Card>
            <h2>Metadados</h2>
            <dl className={styles.metaList}>
              <dt>Pleito</dt>
              <dd>{data.election.name}</dd>
              <dt>Categoria</dt>
              <dd>{data.category?.name ?? "Sem categoria"}</dd>
              <dt>Autor</dt>
              <dd>{data.authorName}</dd>
              <dt>Criado em</dt>
              <dd>{formatDateTime(data.createdAt)}</dd>
              <dt>Agendado para</dt>
              <dd>{data.scheduledAt ? formatDateTime(data.scheduledAt) : "—"}</dd>
              <dt>Publicado em</dt>
              <dd>{data.publishedAt ? formatDateTime(data.publishedAt) : "—"}</dd>
              <dt>Enviado em</dt>
              <dd>{data.dispatchedAt ? formatDateTime(data.dispatchedAt) : "—"}</dd>
              <dt>Expira em</dt>
              <dd>{data.expiresAt ? formatDateTime(data.expiresAt) : "Sem prazo"}</dd>
            </dl>
          </Card>

          <Card>
            <h2>Ações</h2>
            <div className={styles.actions}>
              {["DRAFT", "SCHEDULED"].includes(data.status) && (
                <div className={styles.inlineForm}>
                  <Field label="Agendar para">
                    <Input
                      type="datetime-local"
                      value={scheduledAt}
                      onChange={(event) => setScheduledAt(event.target.value)}
                    />
                  </Field>
                  <Button
                    disabled={!scheduledAt || action.pending}
                    onClick={() =>
                      run(
                        () =>
                          communicationService.schedule(
                            data.id,
                            new Date(scheduledAt).toISOString(),
                          ),
                        "Comunicado agendado.",
                      )
                    }
                  >
                    Agendar
                  </Button>
                </div>
              )}

              {["DRAFT", "SCHEDULED"].includes(data.status) && (
                <Button
                  disabled={action.pending}
                  onClick={() =>
                    run(
                      () => communicationService.publish(data.id),
                      "Comunicado publicado e destinatários acionados.",
                    )
                  }
                >
                  Publicar agora
                </Button>
              )}

              {data.publishedAt && (
                <Button
                  disabled={action.pending}
                  onClick={() =>
                    run(
                      () => communicationService.syncRecipients(data.id),
                      "Destinatários recalculados.",
                    )
                  }
                >
                  Recalcular destinatários
                </Button>
              )}

              {["DRAFT", "SCHEDULED", "PUBLISHED", "EXPIRED"].includes(data.status) && (
                <>
                  <Field label="Motivo (opcional)">
                    <Input
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                    />
                  </Field>
                  <Button
                    disabled={action.pending}
                    onClick={() =>
                      run(
                        () => communicationService.cancel(data.id, reason || undefined),
                        "Comunicado cancelado.",
                      )
                    }
                  >
                    Cancelar comunicado
                  </Button>
                </>
              )}

              {["PUBLISHED", "EXPIRED"].includes(data.status) && (
                <Button
                  disabled={action.pending}
                  onClick={() =>
                    run(() => communicationService.archive(data.id), "Comunicado arquivado.")
                  }
                >
                  Arquivar
                </Button>
              )}

              {!data.publishedAt && (
                <Button
                  disabled={action.pending}
                  onClick={() => {
                    void action
                      .run(() => communicationService.remove(data.id))
                      .then((result) => {
                        if (result === undefined) return;
                        navigate("/communications/messages");
                      });
                  }}
                >
                  Excluir rascunho
                </Button>
              )}
            </div>
          </Card>

          {data.metrics && (
            <Card>
              <h2>Acompanhamento de leitura</h2>
              <MetricGrid metrics={data.metrics} />
              <Link
                className={styles.inlineLink}
                to={`/communications/messages/${data.id}/tracking`}
              >
                Ver destinatários
              </Link>
            </Card>
          )}
        </div>
      </div>

      <Card>
        <h2>Timeline</h2>
        <CommunicationTimeline events={data.timeline ?? []} />
      </Card>
    </section>
  );
}
