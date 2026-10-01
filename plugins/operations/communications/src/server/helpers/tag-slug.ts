/** Marcas de acentuação combinantes (`\p{M}`) produzidas pela normalização NFD. */
const DIACRITICS = /\p{M}/gu;

/** `"Prioridade Alta"` → `"prioridade-alta"`. */
export function slugifyTag(label: string): string {
  return label
    .normalize("NFD")
    .replace(DIACRITICS, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/**
 * Normaliza a lista de etiquetas de um formulário: remove vazias, aplica
 * `trim`, remove repetidas (ignorando acento e caixa) e preserva a ordem.
 */
export function normalizeTagLabels(labels: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of labels) {
    const label = raw.trim().replace(/\s+/g, " ");
    if (!label || label.length > 60) continue;
    const key = slugifyTag(label);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(label);
  }
  return result;
}
