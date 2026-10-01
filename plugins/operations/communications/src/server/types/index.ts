/**
 * Tipos internos do backend de Comunicações Operacionais.
 * Não são exportados para outros plugins.
 */

/** Candidato a destinatário antes de ser persistido. */
export interface RecipientCandidate {
  /** Chave estável de identidade (`user:<id>` ou `member:<id>`). */
  dedupeKey: string;
  userId?: string;
  memberId?: string;
  name: string;
  email?: string;
  roleLabel?: string;
  /** Regra de direcionamento que originou o destinatário. */
  sourceLabel?: string;
  /** Regra de direcionamento que originou o destinatário (para FK). */
  audienceId?: string;
}

/** Ator que executa uma ação de comunicação. */
export interface CommunicationActor {
  id?: string;
  name?: string;
}

export interface RecipientSyncResult {
  created: number;
  removed: number;
  total: number;
  candidates: RecipientCandidate[];
}
