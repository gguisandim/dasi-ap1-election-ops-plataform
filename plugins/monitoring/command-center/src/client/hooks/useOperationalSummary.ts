import { useCallback, useEffect, useRef, useState } from "react";
import type { OperationalScopeInput, OperationalSummary } from "../../types";
import { commandCenterService } from "../services/commandCenterService";

export interface PollingState {
  data?: OperationalSummary;
  error?: Error;
  loading: boolean;
  refreshing: boolean;
  reload: () => void;
}

/**
 * Carrega o resumo operacional e, quando `autoRefresh` está habilitado, repete a
 * consulta por polling.
 *
 * Garantias exigidas pela SPEC: sem WebSocket, sem requisições concorrentes e
 * sem atualização de estado após o unmount.
 */
export function useOperationalSummary(
  scope: OperationalScopeInput,
  refreshSeconds: number,
  autoRefresh: boolean,
): PollingState {
  const [data, setData] = useState<OperationalSummary>();
  const [error, setError] = useState<Error>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const scopeKey = JSON.stringify(scope);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(
    async (background: boolean) => {
      if (inFlight.current) return;
      inFlight.current = true;
      if (background) setRefreshing(true);
      else setLoading(true);
      try {
        const value = await commandCenterService.summary(
          JSON.parse(scopeKey) as OperationalScopeInput,
        );
        if (!mounted.current) return;
        setData(value);
        setError(undefined);
      } catch (cause) {
        if (!mounted.current) return;
        setError(
          cause instanceof Error
            ? cause
            : new Error("Não foi possível carregar o painel operacional."),
        );
      } finally {
        inFlight.current = false;
        if (mounted.current) {
          setRefreshing(false);
          setLoading(false);
        }
      }
    },
    [scopeKey],
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = window.setInterval(
      () => void load(true),
      Math.max(15, refreshSeconds) * 1000,
    );
    return () => window.clearInterval(timer);
  }, [autoRefresh, refreshSeconds, load]);

  const reload = useCallback(() => void load(false), [load]);

  return { data, error, loading, refreshing, reload };
}
