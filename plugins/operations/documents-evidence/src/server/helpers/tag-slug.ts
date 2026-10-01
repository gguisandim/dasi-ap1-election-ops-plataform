/** Marcas de acentuação combinantes produzidas pela normalização NFD. */
const DIACRITICS = /\p{M}/gu;

/** `"Comprovante Assinado"` → `"comprovante-assinado"`. */
export function slugifyTag(label: string): string {
  return label
    .normalize("NFD")
    .replace(DIACRITICS, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Remove vazias, aplica `trim`, colapsa espaços e elimina repetidas. */
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
