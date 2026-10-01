import { useCallback, useState } from "react";
import { useAsync } from "@eops/ui";
import {
  knowledgeService,
  type KnowledgeFilters,
  type RecommendationQuery,
  type UsageInput,
} from "../services/knowledgeService";

export function useKnowledgeList(filters: KnowledgeFilters) {
  const key = JSON.stringify(filters);
  return useAsync(() => knowledgeService.list(filters), [key]);
}

export function useKnowledgeDashboard() {
  return useAsync(() => knowledgeService.dashboard(), []);
}

export function useKnowledgeMetrics() {
  return useAsync(() => knowledgeService.metrics(), []);
}

export function useKnowledgeArticle(id: string | undefined) {
  return useAsync(
    () => (id ? knowledgeService.get(id) : Promise.resolve(undefined)),
    [id ?? ""],
  );
}

export function useKnowledgeReferenceData() {
  return useAsync(() => knowledgeService.referenceData(), []);
}

export function useKnowledgeCategories() {
  return useAsync(() => knowledgeService.categories(), []);
}

/** Recomendações só são buscadas quando há um critério informado. */
export function useRecommendations(query: RecommendationQuery | undefined) {
  const key = JSON.stringify(query ?? null);
  return useAsync(
    () =>
      query && Object.values(query).some((value) => value !== undefined && value !== "")
        ? knowledgeService.recommendations(query)
        : Promise.resolve([]),
    [key],
  );
}

/** Estado de mutação simples com erro legível, usado pelas páginas do plugin. */
export function useKnowledgeMutation<TArgs extends unknown[], TResult>(
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
          reason instanceof Error
            ? reason
            : new Error("Não foi possível concluir a operação."),
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

/** Execução de runbook: acompanha os passos concluídos durante o atendimento. */
export function useRunbookExecution(articleId: string | undefined, totalSteps: number) {
  const [completed, setCompleted] = useState<number[]>([]);
  const [notes, setNotes] = useState("");
  const [outcome, setOutcome] = useState<UsageInput["outcome"]>("RESOLVED");
  const [incidentId, setIncidentId] = useState("");

  const toggle = (order: number) =>
    setCompleted((current) =>
      current.includes(order) ? current.filter((item) => item !== order) : [...current, order],
    );

  const progress = totalSteps > 0 ? Math.round((completed.length / totalSteps) * 100) : 0;

  const submit = (register: (input: UsageInput) => Promise<unknown>) =>
    register({
      outcome,
      stepsCompleted: completed.length,
      notes: notes.trim() || undefined,
      incidentId: incidentId || undefined,
    });

  return {
    completed,
    toggle,
    progress,
    notes,
    setNotes,
    outcome,
    setOutcome,
    incidentId,
    setIncidentId,
    submit,
    articleId,
  };
}
