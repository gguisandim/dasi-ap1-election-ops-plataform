export const COMMUNICATION_CODE_PREFIX = "COM-";
const SEQUENCE_PADDING = 5;

/** `1` → `COM-00001`. */
export function formatCommunicationCode(sequence: number): string {
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new RangeError("A sequência de comunicado deve ser um inteiro positivo.");
  }
  return `${COMMUNICATION_CODE_PREFIX}${String(sequence).padStart(SEQUENCE_PADDING, "0")}`;
}

/** `COM-00042` → `42`. Retorna `null` para códigos fora do padrão. */
export function parseCommunicationSequence(code: string | null | undefined): number | null {
  if (!code?.startsWith(COMMUNICATION_CODE_PREFIX)) return null;
  const digits = code.slice(COMMUNICATION_CODE_PREFIX.length);
  if (!/^\d+$/.test(digits)) return null;
  const parsed = Number(digits);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Deriva a próxima sequência a partir do último código existente.
 *
 * Ao contrário de `count() + 1`, continua correta quando rascunhos são excluídos,
 * porque o código excluído não é reaproveitado.
 */
export function nextCommunicationSequence(lastCode: string | null | undefined): number {
  const parsed = parseCommunicationSequence(lastCode);
  return (parsed ?? 0) + 1;
}
