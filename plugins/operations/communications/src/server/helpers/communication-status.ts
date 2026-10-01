import { CommunicationPriority, CommunicationStatus } from "@prisma/client";

/**
 * Máquina de estados do comunicado.
 *
 * Terminal: `ARCHIVED` e `CANCELLED` não transicionam para mais nada.
 * `EXPIRED` só pode ser arquivado ou cancelado.
 */
export const COMMUNICATION_TRANSITIONS: Record<CommunicationStatus, CommunicationStatus[]> = {
  DRAFT: [CommunicationStatus.SCHEDULED, CommunicationStatus.PUBLISHED, CommunicationStatus.CANCELLED],
  SCHEDULED: [CommunicationStatus.DRAFT, CommunicationStatus.PUBLISHED, CommunicationStatus.CANCELLED],
  PUBLISHED: [CommunicationStatus.EXPIRED, CommunicationStatus.ARCHIVED, CommunicationStatus.CANCELLED],
  EXPIRED: [CommunicationStatus.ARCHIVED, CommunicationStatus.CANCELLED],
  ARCHIVED: [],
  CANCELLED: [],
};

/** Status em que o comunicado já alcançou destinatários e pode ser lido/confirmado. */
export const COMMUNICATION_READABLE_STATUSES: CommunicationStatus[] = [
  CommunicationStatus.PUBLISHED,
  CommunicationStatus.EXPIRED,
];

/** Status em que título e conteúdo ainda podem ser alterados. */
export const COMMUNICATION_EDITABLE_STATUSES: CommunicationStatus[] = [
  CommunicationStatus.DRAFT,
  CommunicationStatus.SCHEDULED,
  CommunicationStatus.PUBLISHED,
];

/** Status terminais: nenhuma edição de conteúdo é aceita. */
export const COMMUNICATION_TERMINAL_STATUSES: CommunicationStatus[] = [
  CommunicationStatus.EXPIRED,
  CommunicationStatus.ARCHIVED,
  CommunicationStatus.CANCELLED,
];

/** Peso de ordenação: maior valor aparece primeiro. */
export const COMMUNICATION_PRIORITY_WEIGHT: Record<CommunicationPriority, number> = {
  LOW: 1,
  NORMAL: 2,
  HIGH: 3,
  CRITICAL: 4,
};

const URGENT_PRIORITIES: CommunicationPriority[] = [
  CommunicationPriority.HIGH,
  CommunicationPriority.CRITICAL,
];

export function canTransition(from: CommunicationStatus, to: CommunicationStatus): boolean {
  if (from === to) return false;
  return COMMUNICATION_TRANSITIONS[from].includes(to);
}

export function transitionError(from: CommunicationStatus, to: CommunicationStatus): string {
  return `Transição de ${from} para ${to} não permitida.`;
}

export function isUrgentPriority(priority: CommunicationPriority): boolean {
  return URGENT_PRIORITIES.includes(priority);
}

export function isReadableStatus(status: CommunicationStatus): boolean {
  return COMMUNICATION_READABLE_STATUSES.includes(status);
}

export function isEditableStatus(status: CommunicationStatus): boolean {
  return COMMUNICATION_EDITABLE_STATUSES.includes(status);
}

/**
 * Expiração derivada: um comunicado publicado cujo prazo já passou é expirado
 * mesmo antes de qualquer rotina de persistência rodar.
 */
export function isOverdueExpiration(
  communication: { status: CommunicationStatus; expiresAt: Date | null },
  now: Date = new Date(),
): boolean {
  return (
    communication.status === CommunicationStatus.PUBLISHED &&
    communication.expiresAt !== null &&
    communication.expiresAt.getTime() <= now.getTime()
  );
}

/** Ordena por prioridade (desc) e, em empate, pela data mais recente. */
export function compareByPriorityThenDate(
  left: { priority: CommunicationPriority; createdAt: Date | string },
  right: { priority: CommunicationPriority; createdAt: Date | string },
): number {
  const weight = COMMUNICATION_PRIORITY_WEIGHT[right.priority] - COMMUNICATION_PRIORITY_WEIGHT[left.priority];
  if (weight !== 0) return weight;
  return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
}
