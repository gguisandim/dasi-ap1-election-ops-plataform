import { useAsync } from "@eops/ui";
import { commandCenterService } from "../services/commandCenterService";

/**
 * Permissões do usuário atual resolvidas pela API pública de autenticação.
 * Evita importar a implementação interna de outro plugin; o backend continua
 * sendo a autoridade final sobre cada operação.
 */
export function useHasPermission(permission: string) {
  const current = useAsync(commandCenterService.currentUser, []);
  return {
    loading: current.loading,
    allowed: Boolean(current.data?.permissions.includes(permission)),
  };
}
