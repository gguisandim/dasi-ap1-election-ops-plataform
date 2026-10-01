export const EVIDENCE_CODE_PREFIX = "EVD-";
const SEQUENCE_PADDING = 5;

/** `1` → `EVD-00001`. */
export function formatEvidenceCode(sequence: number): string {
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new RangeError("A sequência de evidência deve ser um inteiro positivo.");
  }
  return `${EVIDENCE_CODE_PREFIX}${String(sequence).padStart(SEQUENCE_PADDING, "0")}`;
}

/** `EVD-00042` → `42`. Retorna `null` para códigos fora do padrão. */
export function parseEvidenceSequence(code: string | null | undefined): number | null {
  if (!code?.startsWith(EVIDENCE_CODE_PREFIX)) return null;
  const digits = code.slice(EVIDENCE_CODE_PREFIX.length);
  if (!/^\d+$/.test(digits)) return null;
  const parsed = Number(digits);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

/** Próxima sequência a partir do último código emitido. */
export function nextEvidenceSequence(lastCode: string | null | undefined): number {
  return (parseEvidenceSequence(lastCode) ?? 0) + 1;
}
