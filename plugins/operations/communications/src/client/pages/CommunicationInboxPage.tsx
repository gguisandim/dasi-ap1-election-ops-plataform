import { useState } from "react";
import { Card, EmptyState, ErrorState, LinkButton, Loading, useAsync } from "@eops/ui";
import type { CommunicationRecipientSummary } from "@eops/shared/communications";
import { InboxList } from "../components/InboxList";
import { communicationService } from "../services/communicationService";
import { useMutation } from "../hooks/useCommunications";
import styles from "../styles/communications.module.css";

/**
 * Caixa do operador: comunicados publicados dirigidos ao usuário autenticado.
 *
 * A confirmação é registrada na mesma linha em que o operador declara ciência,
 * alimentando o indicador de acompanhamento visto pela coordenação.
 */
export function CommunicationInboxPage() {
  const [busyId, setBusyId] = useState<string>();
  const [feedback, setFeedback] = useState<string>();

  const pending = useAsync(() => communicationService.pendingForMe(), []);
  const inbox = useAsync(() => communicationService.inbox(), []);

  const action = useMutation(
    async (operation: () => Promise<unknown>) => operation(),
    () => {
      pending.reload();
      inbox.reload();
    },
  );

  const run = (
    recipient: CommunicationRecipientSummary,
    operation: () => Promise<unknown>,
    message: string,
  ) => {
    setBusyId(recipient.id);
    setFeedback(undefined);
    void action.run(operation).then((result) => {
      setBusyId(undefined);
      if (result !== undefined) setFeedback(message);
    });
  };

  const pendingCount = pending.data?.length ?? 0;

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>COMUNICAÇÕES</span>
          <h1>Minha caixa</h1>
          <p>
            {pendingCount === 0
              ? "Nenhuma confirmação pendente."
              : `${pendingCount} comunicado(s) aguardando confirmação de leitura.`}
          </p>
        </div>
        <LinkButton to="/communications" secondary>
          Voltar ao painel
        </LinkButton>
      </header>

      {action.error && <ErrorState error={action.error} />}
      {feedback && <p className={styles.successText}>{feedback}</p>}

      <Card>
        <h2>Pendentes de confirmação</h2>
        {pending.loading && <Loading label="Carregando pendências…" />}
        {pending.error && <ErrorState error={pending.error} onRetry={pending.reload} />}
        {!pending.loading && pendingCount === 0 && (
          <EmptyState
            title="Tudo em ordem"
            description="Você confirmou a leitura de todos os comunicados dirigidos a você."
          />
        )}
        {pendingCount > 0 && (
          <InboxList
            items={pending.data ?? []}
            busyId={busyId}
            onMarkRead={(recipient) =>
              run(
                recipient,
                () =>
                  communicationService.markRead(recipient.communicationId, recipient.id),
                "Leitura registrada.",
              )
            }
            onConfirm={(recipient) =>
              run(
                recipient,
                () =>
                  communicationService.confirm(recipient.communicationId, recipient.id),
                "Ciência confirmada.",
              )
            }
          />
        )}
      </Card>

      <Card>
        <h2>Histórico</h2>
        {inbox.loading && <Loading label="Carregando histórico…" />}
        {inbox.error && <ErrorState error={inbox.error} onRetry={inbox.reload} />}
        {!inbox.loading && (inbox.data?.length ?? 0) === 0 && (
          <p className={styles.mutedText}>
            Nenhum comunicado publicado foi dirigido a você até agora.
          </p>
        )}
        {(inbox.data?.length ?? 0) > 0 && (
          <InboxList
            items={inbox.data ?? []}
            busyId={busyId}
            onMarkRead={(recipient) =>
              run(
                recipient,
                () =>
                  communicationService.markRead(recipient.communicationId, recipient.id),
                "Leitura registrada.",
              )
            }
            onConfirm={(recipient) =>
              run(
                recipient,
                () =>
                  communicationService.confirm(recipient.communicationId, recipient.id),
                "Ciência confirmada.",
              )
            }
          />
        )}
      </Card>
    </section>
  );
}
