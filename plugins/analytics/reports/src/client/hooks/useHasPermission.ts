import { useAsync } from "@eops/ui";
import { reportsService } from "../../services/reportsService";

/**
 * Permissoes do usuario atual resolvidas pela API publica de autenticacao.
 * Evita importar a implementacao interna de outro plugin; o backend continua
 * sendo a autoridade final sobre cada operacao (SPEC 2.10).
 */
export function useHasPermission(permission: string) {
  const current = useAsync(reportsService.currentUser, []);
  return {
    loading: current.loading,
    allowed: Boolean(current.data?.permissions.includes(permission)),
  };
}
