import { AuditEventSeverity } from "@prisma/client";

/**
 * Regras puras de enriquecimento, sanitização e apresentação da auditoria.
 *
 * Nada aqui consulta banco ou recebe permissões de fora além de uma lista de
 * strings, o que torna as decisões de RBAC, severidade e diff testáveis isoladamente.
 */

/** Substrings de chave consideradas sensíveis, comparadas por inclusão e sem caixa. */
export const SENSITIVE_KEY_SUBSTRINGS = [
  "password",
  "senha",
  "passwd",
  "token",
  "secret",
  "authorization",
  "apikey",
  "api_key",
  "credential",
  "refresh_token",
  "access_token",
  "private_key",
  "certificate",
  "hash",
  "cookie",
  "sessionid",
  "cpf",
] as const;

export const REDACTED = "[REDACTED]";
export const TRUNCATED_MARKER = "[TRUNCATED]";
export const AUDIT_PAYLOAD_MAX_BYTES = 8 * 1024;
export const AUDIT_DIFF_MAX_CHANGED = 200;

export function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase();
  return SENSITIVE_KEY_SUBSTRINGS.some((needle) => normalized.includes(needle));
}

/**
 * Redige recursivamente chaves sensíveis preservando a forma do objeto.
 * Aplicada tanto na escrita quanto na leitura (defesa em profundidade).
 */
export function sanitizeAuditValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeAuditValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, child]) => [
        key,
        isSensitiveKey(key) ? REDACTED : sanitizeAuditValue(child),
      ]),
    );
  }
  return value;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function byteSize(value: string): number {
  return encoder.encode(value).length;
}

function truncateUtf8(value: string, maxBytes: number): string {
  if (byteSize(value) <= maxBytes) return value;
  return decoder.decode(encoder.encode(value).subarray(0, maxBytes));
}

/**
 * Payload acima de `maxBytes` é truncado com marcador em vez de rejeitado.
 * Abaixo do limite devolve o valor original inalterado.
 */
export function truncateAuditPayload(
  value: unknown,
  maxBytes = AUDIT_PAYLOAD_MAX_BYTES,
): unknown {
  if (value === null || value === undefined) return value;
  const serialized = JSON.stringify(value);
  if (serialized === undefined) return value;
  if (byteSize(serialized) <= maxBytes) return value;
  return {
    truncated: true,
    marker: TRUNCATED_MARKER,
    preview: truncateUtf8(serialized, maxBytes),
  };
}

function toKebabCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[_\s]+/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();
}

/**
 * Categoria = namespace do eventName (prefixo antes do primeiro ponto).
 * Sem eventName, deriva do entityType em minúsculas kebab.
 */
export function deriveCategory(
  eventName: string | null | undefined,
  entityType: string,
): string {
  if (eventName && eventName.trim()) {
    const [namespace] = eventName.split(".");
    if (namespace) return namespace;
  }
  return toKebabCase(entityType);
}

/**
 * Severidade normativa (SPEC 4.3):
 * CRITICAL para falha/escalonamento/cancelamento crítico;
 * WARNING para mudança de status/severidade;
 * NOTICE para criação; INFO para o restante.
 */
export function deriveSeverity(eventName: string): AuditEventSeverity {
  const name = eventName.toLowerCase();
  if (/(fail|escalat|critical|cancel)/.test(name)) return AuditEventSeverity.CRITICAL;
  if (name.includes("changed")) return AuditEventSeverity.WARNING;
  if (/(create|created)/.test(name)) return AuditEventSeverity.NOTICE;
  return AuditEventSeverity.INFO;
}

/** Copia electionId/electoralZoneId do payload quando presentes e string. Nunca infere. */
export function copyScopeFields(payload: Record<string, unknown>): {
  electionId?: string;
  electoralZoneId?: string;
} {
  return {
    electionId: typeof payload.electionId === "string" ? payload.electionId : undefined,
    electoralZoneId:
      typeof payload.electoralZoneId === "string" ? payload.electoralZoneId : undefined,
  };
}

/** Mapa categoria → permissão de leitura de domínio (SPEC 4.7). */
export const CATEGORY_PERMISSIONS: Record<string, string> = {
  incident: "incidents.read",
  asset: "inventory.read",
  route: "routes.read",
  delivery: "routes.read",
  transmission: "transmission.read",
  resource_request: "resource-requests.read",
  postmortem: "postmortems.read",
  task: "tasks.read",
  shift: "shifts.read",
  shift_handover: "shift-handovers.read",
  field_team: "field-teams.read",
  field_member: "field-teams.read",
  field_dispatch: "field-teams.read",
  preparation_checklist: "preparation-checklists.read",
  communication: "communications.read",
  evidence: "evidence.read",
  runbook: "knowledge.read",
  risk: "risks.read",
  user: "users.read",
  election: "elections.read",
  command_center: "command-center.read",
  simulation: "simulation.read",
};

/**
 * Reverso de `inferEntityType` para o endpoint de timeline. Só reconhece tipos
 * conhecidos; tipo desconhecido devolve `undefined` e a decisão fica por conta
 * das categorias efetivamente observadas nas linhas.
 */
const ENTITY_TYPE_CATEGORIES: Record<string, string> = {
  Incident: "incident",
  IncidentCategory: "incident",
  Asset: "asset",
  User: "user",
  Election: "election",
  DistributionRoute: "route",
  Delivery: "delivery",
  TransmissionPoint: "transmission",
  FieldAllocation: "field_team",
  FieldMember: "field_member",
  Communication: "communication",
  Evidence: "evidence",
  Runbook: "runbook",
  Risk: "risk",
  PreparationChecklist: "preparation_checklist",
  Task: "task",
  FieldShift: "shift",
  ShiftHandover: "shift_handover",
  ResourceRequest: "resource_request",
  Postmortem: "postmortem",
  PostmortemActionItem: "postmortem",
  CommandCenterSnapshot: "command_center",
  CommandCenterSavedView: "command_center",
  ReportSavedView: "report_view",
};

export function categoryForEntityType(entityType: string): string | undefined {
  if (ENTITY_TYPE_CATEGORIES[entityType]) return ENTITY_TYPE_CATEGORIES[entityType];
  if (CATEGORY_PERMISSIONS[entityType]) return entityType;
  return undefined;
}

export function categoryPermission(category: string | null | undefined): string | undefined {
  if (!category) return undefined;
  return CATEGORY_PERMISSIONS[category];
}

/** Categoria sem mapeamento é negada por padrão. */
export function canReadCategory(
  category: string | null | undefined,
  permissions: readonly string[],
): boolean {
  const required = categoryPermission(category);
  return Boolean(required && permissions.includes(required));
}

export interface CategoryAccess {
  allowed: string[];
  restricted: string[];
}

/**
 * Separa as categorias presentes no escopo entre legíveis e restritas.
 * Categorias nulas sem nome não são declaradas (apenas removidas do resultado).
 */
export function partitionCategories(
  categories: Iterable<string | null | undefined>,
  permissions: readonly string[],
): CategoryAccess {
  const allowed = new Set<string>();
  const restricted = new Set<string>();
  for (const category of categories) {
    if (!category) continue;
    if (canReadCategory(category, permissions)) allowed.add(category);
    else restricted.add(category);
  }
  return { allowed: [...allowed], restricted: [...restricted] };
}

export interface AuditDiffEntry {
  field: string;
  before: unknown;
  after: unknown;
}

export interface AuditDiff {
  changed: AuditDiffEntry[];
  unchanged: number;
  truncated: boolean;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

/**
 * Diff normalizado sobre a união das chaves de oldData e newData.
 * Campos de um único lado aparecem com null no lado ausente; iguais contam em
 * `unchanged`; `changed` é limitado a 200 entradas com `truncated` quando excede.
 */
export function buildAuditDiff(oldValue: unknown, newValue: unknown): AuditDiff {
  const before = asRecord(oldValue);
  const after = asRecord(newValue);
  const fields = [...new Set([...Object.keys(before), ...Object.keys(after)])];
  const changed: AuditDiffEntry[] = [];
  let unchanged = 0;
  let truncated = false;
  for (const field of fields) {
    const left = field in before ? before[field] : null;
    const right = field in after ? after[field] : null;
    if (sameValue(left, right)) {
      unchanged += 1;
      continue;
    }
    if (changed.length >= AUDIT_DIFF_MAX_CHANGED) {
      truncated = true;
      continue;
    }
    const sensitive = isSensitiveKey(field);
    changed.push({
      field,
      before: sensitive ? REDACTED : sanitizeAuditValue(left),
      after: sensitive ? REDACTED : sanitizeAuditValue(right),
    });
  }
  return { changed, unchanged, truncated };
}
