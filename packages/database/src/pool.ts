/**
 * Dimensionamento do pool de conexões do Prisma.
 *
 * O pool padrão do Prisma é calculado por núcleos da máquina (`núcleos × 2 + 1`)
 * e pode exceder o limite de sessões de um PostgreSQL atrás de pooler — por
 * exemplo, 15 sessões em modo session. Quando isso acontece, consultas
 * paralelas falham com `EMAXCONNSESSION` e o erro chega ao cliente como um 500
 * sem contexto, em endpoints de leitura comuns.
 *
 * Limitar o pool faz o Prisma **enfileirar** em vez de estourar. O valor pode
 * ser ajustado por `DATABASE_CONNECTION_LIMIT`; uma URL que já declare
 * `connection_limit` é respeitada como está.
 */
const DEFAULT_CONNECTION_LIMIT = 5;
const DEFAULT_POOL_TIMEOUT_SECONDS = 20;

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function appendParam(url: string, key: string, value: number) {
  if (new RegExp(`[?&]${key}=`).test(url)) return url;
  return `${url}${url.includes("?") ? "&" : "?"}${key}=${value}`;
}

/** Aplica limite de pool e tempo de espera à URL do banco. */
export function databaseUrlWithPoolLimits(
  url: string | undefined = process.env.DATABASE_URL,
): string | undefined {
  if (!url) return url;
  const withLimit = appendParam(
    url,
    "connection_limit",
    positiveInteger(process.env.DATABASE_CONNECTION_LIMIT, DEFAULT_CONNECTION_LIMIT),
  );
  return appendParam(
    withLimit,
    "pool_timeout",
    positiveInteger(process.env.DATABASE_POOL_TIMEOUT_SECONDS, DEFAULT_POOL_TIMEOUT_SECONDS),
  );
}

/**
 * Tempo que uma transação interativa pode esperar por uma conexão e durar.
 *
 * O padrão do Prisma (2s de espera, 5s de duração) é apertado quando o pool é
 * limitado: a transação enfileira atrás de outras consultas e expira, devolvendo
 * 500. Como o pool agora é dimensionado para o pooler, a espera precisa
 * acompanhar.
 */
const DEFAULT_TRANSACTION_MAX_WAIT_MS = 10_000;
const DEFAULT_TRANSACTION_TIMEOUT_MS = 15_000;

/**
 * Opções de construção do cliente Prisma. Sem `DATABASE_URL` definida, omite o
 * datasource para que o Prisma use a configuração do schema e falhe com o erro
 * original dele, em vez de um erro nosso.
 */
export function prismaClientOptions(): {
  datasources?: { db: { url: string } };
  transactionOptions: {
    maxWait: number;
    timeout: number;
  };
} {
  const url = databaseUrlWithPoolLimits();
  return {
    ...(url ? { datasources: { db: { url } } } : {}),
    transactionOptions: {
      maxWait: positiveInteger(
        process.env.DATABASE_TRANSACTION_MAX_WAIT_MS,
        DEFAULT_TRANSACTION_MAX_WAIT_MS,
      ),
      timeout: positiveInteger(
        process.env.DATABASE_TRANSACTION_TIMEOUT_MS,
        DEFAULT_TRANSACTION_TIMEOUT_MS,
      ),
    },
  };
}
