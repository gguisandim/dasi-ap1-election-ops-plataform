/** Marcas de acentuação combinantes produzidas pela normalização NFD. */
const DIACRITICS = /\p{M}/gu;

export function slugifyTag(label: string): string {
  return label
    .normalize("NFD")
    .replace(DIACRITICS, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

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

/** Normaliza palavras-chave: minúsculas, sem acento, únicas, até 20 termos. */
export function normalizeKeywords(keywords: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of keywords) {
    const keyword = raw.normalize("NFD").replace(DIACRITICS, "").toLowerCase().trim();
    if (keyword.length < 3 || keyword.length > 40) continue;
    if (seen.has(keyword)) continue;
    seen.add(keyword);
    result.push(keyword);
    if (result.length >= 20) break;
  }
  return result;
}
