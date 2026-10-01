/** `1536` → `"1,5 KB"`. Espelha o formatador do backend para consistência visual. */
export function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(1).replace(".", ",")} ${units[index]}`;
}

/** Prefixo do checksum, usado em listagens compactas. */
export function checksumPrefix(checksum: string, length = 12): string {
  return checksum.slice(0, length);
}

/**
 * Checksum em blocos de quatro caracteres, formato usado em conferência manual.
 * `"a3f19c02…"` → `"a3f1 9c02 …"`.
 */
export function formatChecksum(checksum: string, groups = 4): string {
  const size = 4;
  const slice = checksum.slice(0, groups * size);
  return slice.replace(new RegExp(`(.{${size}})`, "g"), "$1 ").trim();
}

/** `"jpg"` → `"JPG"`; vazio → `"SEM EXTENSÃO"`. */
export function extensionLabel(extension: string): string {
  return extension ? extension.toUpperCase() : "SEM EXTENSÃO";
}

/** Diferença legível entre duas datas, usada na comparação de versões. */
export function describeInterval(from: string, to: string): string {
  const diffMs = new Date(to).getTime() - new Date(from).getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h`;
  return `${Math.round(hours / 24)} dias`;
}
