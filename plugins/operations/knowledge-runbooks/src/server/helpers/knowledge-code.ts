export const KNOWLEDGE_CODE_PREFIX = "KB-";
const SEQUENCE_PADDING = 5;

/** `1` → `KB-00001`. Código compartilhado por artigos e runbooks. */
export function formatKnowledgeCode(sequence: number): string {
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new RangeError("A sequência de conhecimento deve ser um inteiro positivo.");
  }
  return `${KNOWLEDGE_CODE_PREFIX}${String(sequence).padStart(SEQUENCE_PADDING, "0")}`;
}

/** `KB-00042` → `42`. Retorna `null` para códigos fora do padrão. */
export function parseKnowledgeSequence(code: string | null | undefined): number | null {
  if (!code?.startsWith(KNOWLEDGE_CODE_PREFIX)) return null;
  const digits = code.slice(KNOWLEDGE_CODE_PREFIX.length);
  if (!/^\d+$/.test(digits)) return null;
  const parsed = Number(digits);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function nextKnowledgeSequence(lastCode: string | null | undefined): number {
  return (parseKnowledgeSequence(lastCode) ?? 0) + 1;
}
