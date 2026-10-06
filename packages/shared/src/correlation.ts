import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Correlation ID de cadeia operacional.
 *
 * Fluxo coberto: requisição HTTP → operação de serviço → Event Bus → auditoria e
 * notificação. O valor viaja em `AsyncLocalStorage`, de modo que nenhum serviço
 * precisa recebê-lo por parâmetro.
 *
 * IMPORTANTE: este arquivo é carregado em runtime pelo Node em modo strip-only.
 * Use apenas sintaxe apagável (sem `enum`, sem `namespace`, sem property
 * parameters). O runtime rejeita o módulo inteiro caso contrário.
 */

const storage = new AsyncLocalStorage<string>();

/** Comprimento máximo aceito de um correlation ID recebido de fora. */
export const CORRELATION_ID_MAX_LENGTH = 64;

/** Header HTTP usado para propagar o correlation ID. */
export const CORRELATION_ID_HEADER = "x-correlation-id";

const ALLOWED_PATTERN = /^[\x20-\x7E]+$/;

/**
 * Aceita um correlation ID externo somente quando é seguro persistir e ecoar.
 * Valor inválido devolve `null`, e o chamador deve gerar um novo.
 */
export function normalizeCorrelationId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > CORRELATION_ID_MAX_LENGTH) return null;
  if (!ALLOWED_PATTERN.test(trimmed)) return null;
  return trimmed;
}

/** Correlation ID ativo no contexto assíncrono atual, ou `undefined`. */
export function currentCorrelationId(): string | undefined {
  return storage.getStore();
}

/** Executa `fn` com o correlation ID informado ativo. */
export function runWithCorrelationId<T>(correlationId: string | undefined, fn: () => T): T {
  if (!correlationId) return fn();
  return storage.run(correlationId, fn);
}
