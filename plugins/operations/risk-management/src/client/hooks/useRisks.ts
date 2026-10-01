import { useCallback, useState } from "react";
import { useAsync } from "@eops/ui";
import { riskService, type RiskFilters } from "../services/riskService";

export function useRiskList(filters: RiskFilters) {
  return useAsync(() => riskService.list(filters), [JSON.stringify(filters)]);
}

export function useRiskDashboard(electionId?: string) {
  return useAsync(() => riskService.dashboard(electionId), [electionId ?? ""]);
}

export function useRiskMatrix(filters: RiskFilters) {
  return useAsync(() => riskService.matrix(filters), [JSON.stringify(filters)]);
}

export function useRisk(id: string | undefined) {
  return useAsync(
    () => (id ? riskService.get(id) : Promise.resolve(undefined)),
    [id ?? ""],
  );
}

export function useRiskReferenceData() {
  return useAsync(() => riskService.referenceData(), []);
}

export function useRiskCategories() {
  return useAsync(() => riskService.categories(), []);
}

/** Estado de mutação com erro legível, repetido em todas as páginas do plugin. */
export function useRiskMutation<TArgs extends unknown[], TResult>(
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
    [action, onSuccess],
  );

  return { run, pending, error, setError };
}
