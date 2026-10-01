import { createHash, randomUUID } from "node:crypto";
import path from "node:path";

/** SHA-256 do conteúdo, em hexadecimal minúsculo. */
export function sha256(data: Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

/** `"relatorio.pdf"` → `"pdf"`; sem extensão → `""`. */
export function extensionOf(fileName: string): string {
  const extension = path.extname(fileName).replace(/^\./, "").toLowerCase();
  return extension.slice(0, 12);
}

/**
 * Normaliza o nome original para uma forma segura de exibição e de composição
 * de chave: sem diretórios, sem caracteres de controle e com tamanho limitado.
 */
export function safeOriginalName(fileName: string): string {
  const base = path.basename(fileName.replace(/\\/g, "/"));
  const cleaned = base
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[<>:"|?*]/g, "_")
    .trim();
  return (cleaned || "arquivo").slice(0, 200);
}

/** Nome físico do objeto: identificador único + extensão, sem dados do usuário. */
export function storageFileName(fileName: string): string {
  const extension = extensionOf(fileName);
  return extension ? `${randomUUID()}.${extension}` : randomUUID();
}

/** Diretório lógico por ano/mês, mantendo o volume de objetos distribuído. */
export function storageDirectory(date: Date = new Date()): string {
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${date.getUTCFullYear()}/${month}`;
}

/** `1536` → `"1,5 KB"`. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(1).replace(".", ",")} ${units[unitIndex]}`;
}

/** Prefixo legível do checksum, usado em listagens compactas. */
export function shortChecksum(checksum: string): string {
  return checksum.slice(0, 12);
}
