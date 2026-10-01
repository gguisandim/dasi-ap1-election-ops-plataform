export const RISK_CODE_PREFIX = "RSK-";
const SEQUENCE_PADDING = 5;

/** `1` → `RSK-00001`. */
export function formatRiskCode(sequence: number): string {
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new RangeError("A sequência de risco deve ser um inteiro positivo.");
  }
  return `${RISK_CODE_PREFIX}${String(sequence).padStart(SEQUENCE_PADDING, "0")}`;
}

export function parseRiskSequence(code: string | null | undefined): number | null {
  if (!code?.startsWith(RISK_CODE_PREFIX)) return null;
  const digits = code.slice(RISK_CODE_PREFIX.length);
  if (!/^\d+$/.test(digits)) return null;
  const parsed = Number(digits);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function nextRiskSequence(lastCode: string | null | undefined): number {
  return (parseRiskSequence(lastCode) ?? 0) + 1;
}
