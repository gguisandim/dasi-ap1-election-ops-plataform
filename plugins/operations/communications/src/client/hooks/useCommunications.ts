import { useCallback, useEffect, useState } from "react";
import { useAsync } from "@eops/ui";
import {
  communicationService,
  type CommunicationFilters,
  type RecipientFilters,
  type ReferenceData,
} from "../services/communicationService";

/** Lista paginada de comunicados com filtros controlados. */
export function useCommunicationList(filters: CommunicationFilters) {
  const key = JSON.stringify(filters);
  return useAsync(() => communicationService.list(filters), [key]);
}

/** Indicadores do painel, opcionalmente restritos a um pleito. */
export function useCommunicationDashboard(electionId?: string) {
  return useAsync(() => communicationService.dashboard(electionId), [electionId ?? ""]);
}

/** Detalhe completo de um comunicado. */
export function useCommunication(id: string | undefined) {
  return useAsync(
    () => (id ? communicationService.get(id) : Promise.resolve(undefined)),
    [id ?? ""],
  );
}

/** Destinatários paginados de um comunicado. */
export function useCommunicationRecipients(
  id: string | undefined,
  filters: RecipientFilters,
) {
  const key = JSON.stringify(filters);
  return useAsync(
    () =>
      id
        ? communicationService.recipients(id, filters)
        : Promise.resolve(undefined),
    [id ?? "", key],
  );
}

/**
 * Dados de apoio do formulário.
 *
 * O pleito selecionado reduz o volume: zonas, locais e equipes de outros pleitos
 * não fazem sentido como destino de um comunicado.
 */
export function useCommunicationReferenceData(electionId?: string) {
  return useAsync<ReferenceData>(
    () => communicationService.referenceData(electionId),
    [electionId ?? ""],
  );
}

/**
 * Executa uma mutação e devolve estado de erro/pendência local.
 * Evita repetir o mesmo `try/catch` em cada página.
 */
export function useMutation<TArgs extends unknown[], TResult>(
  action: (...args: TArgs) => Promise<TResult>,
  onSuccess?: (result: TResult) => void,
) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<Error>();

  const run = useCallback(
    async (...args: TArgs) => {
      setPending(true);
      setError(undefined);
      try {
        const result = await action(...args);
        onSuccess?.(result);
        return result;
      } catch (reason) {
        setError(
          reason instanceof Error ? reason : new Error("Não foi possível concluir a operação."),
        );
        return undefined;
      } finally {
        setPending(false);
      }
    },
    // `action` é recriada a cada render pelas páginas; a identidade estável de
    // `run` depende apenas do callback de sucesso.
    [onSuccess],
  );

  return { run, pending, error, setError };
}

/**
 * Recarrega uma consulta em intervalo controlado (auto-refresh leve).
 * `intervalMs` igual a `0` desliga a atualização.
 */
export function useAutoRefresh(reload: () => void, intervalMs: number) {
  useEffect(() => {
    if (!intervalMs) return undefined;
    const timer = setInterval(reload, intervalMs);
    return () => clearInterval(timer);
  }, [reload, intervalMs]);
}
