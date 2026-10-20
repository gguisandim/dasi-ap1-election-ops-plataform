import type { CallToolResult, Tool } from "@modelcontextprotocol/sdk/types.js";

export interface TaskApiConfig {
  apiUrl: string;
  token: string;
}

type FetchFunction = typeof fetch;
type JsonRecord = Record<string, unknown>;

const TASK_STATUSES = ["PENDING", "IN_PROGRESS", "BLOCKED", "DONE", "CANCELLED"];
const TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const TASK_EXECUTION_MODES = ["OFFICE", "FIELD", "MIXED"];

const listTaskFilters = {
  type: "object",
  additionalProperties: false,
  properties: {
    electionId: { type: "string", minLength: 1 },
    electoralZoneId: { type: "string", minLength: 1 },
    pollingPlaceId: { type: "string", minLength: 1 },
    assigneeId: { type: "string", minLength: 1 },
    status: { type: "string", enum: TASK_STATUSES },
    priority: { type: "string", enum: TASK_PRIORITIES },
    executionMode: { type: "string", enum: TASK_EXECUTION_MODES },
    labelId: { type: "string", minLength: 1 },
    milestoneId: { type: "string", minLength: 1 },
    overdue: { type: "boolean" },
    search: { type: "string", maxLength: 160 },
  },
} as const;

const createTaskSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "electionId"],
  properties: {
    title: { type: "string", minLength: 2, maxLength: 180 },
    electionId: { type: "string", minLength: 1 },
    description: { type: "string", maxLength: 5000 },
    electoralZoneId: { type: "string", minLength: 1 },
    pollingPlaceId: { type: "string", minLength: 1 },
    assigneeId: { type: "string", minLength: 1 },
    parentId: { type: "string", minLength: 1 },
    priority: { type: "string", enum: TASK_PRIORITIES },
    executionMode: { type: "string", enum: TASK_EXECUTION_MODES },
    requiredTeamSize: { type: ["integer", "null"], minimum: 1 },
    requiredSpecialtyIds: { type: "array", items: { type: "string" } },
    dueAt: { type: "string", description: "Data ISO 8601 aceita pelo DTO da API." },
  },
} as const;

const updateTaskSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id"],
  properties: {
    id: { type: "string", minLength: 1 },
    title: { type: "string", minLength: 2, maxLength: 180 },
    description: { type: ["string", "null"], maxLength: 5000 },
    electionId: { type: "string", minLength: 1 },
    electoralZoneId: { type: ["string", "null"] },
    pollingPlaceId: { type: ["string", "null"] },
    assigneeId: { type: ["string", "null"] },
    priority: { type: "string", enum: TASK_PRIORITIES },
    status: { type: "string", enum: TASK_STATUSES },
    executionMode: { type: "string", enum: TASK_EXECUTION_MODES },
    requiredTeamSize: { type: ["integer", "null"], minimum: 1 },
    requiredSpecialtyIds: { type: "array", items: { type: "string" } },
    dueAt: { type: ["string", "null"], description: "Data ISO 8601 aceita pelo DTO da API ou nulo." },
    labelIds: { type: "array", items: { type: "string" } },
    milestoneId: { type: ["string", "null"] },
  },
} as const;

const taskTools: Tool[] = [
  {
    name: "listar_tarefas",
    description: "Lista tarefas operacionais usando somente filtros suportados pela API.",
    inputSchema: listTaskFilters,
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
  },
  {
    name: "consultar_tarefa",
    description: "Consulta os detalhes de uma tarefa pelo identificador.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["id"],
      properties: { id: { type: "string", minLength: 1 } },
    },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
  },
  {
    name: "criar_tarefa",
    description: "Cria uma tarefa quando o usuário solicitar explicitamente essa operação.",
    inputSchema: {
  ...createTaskSchema,
  required: [...createTaskSchema.required],
},
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
  },
  {
    name: "atualizar_tarefa",
    description: "Atualiza uma tarefa quando o usuário solicitar explicitamente essa operação.",
    inputSchema: {
  ...updateTaskSchema,
  required: [...updateTaskSchema.required],
},
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
  },
];

const CREATE_FIELDS = Object.keys(createTaskSchema.properties);
const UPDATE_FIELDS = Object.keys(updateTaskSchema.properties).filter((key) => key !== "id");
const LIST_FIELDS = Object.keys(listTaskFilters.properties);

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function ensureOnlyFields(input: JsonRecord, fields: readonly string[]) {
  const unsupported = Object.keys(input).find((key) => !fields.includes(key));
  if (unsupported) throw new Error(`Campo não suportado: ${unsupported}.`);
}

function requiredString(input: JsonRecord, field: string) {
  const value = input[field];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`O campo "${field}" é obrigatório e deve ser texto.`);
  }
  return value;
}

function optionalString(input: JsonRecord, field: string, options: { nullable?: boolean; maxLength?: number } = {}) {
  const value = input[field];
  if (value === undefined || (options.nullable && value === null)) return;
  if (typeof value !== "string") throw new Error(`O campo "${field}" deve ser texto${options.nullable ? " ou nulo" : ""}.`);
  if (options.maxLength !== undefined && value.length > options.maxLength) {
    throw new Error(`O campo "${field}" deve ter no máximo ${options.maxLength} caracteres.`);
  }
}

function optionalEnum(input: JsonRecord, field: string, values: readonly string[]) {
  const value = input[field];
  if (value !== undefined && (typeof value !== "string" || !values.includes(value))) {
    throw new Error(`O campo "${field}" deve ser um destes valores: ${values.join(", ")}.`);
  }
}

function optionalStringArray(input: JsonRecord, field: string) {
  const value = input[field];
  if (value !== undefined && (!Array.isArray(value) || value.some((item) => typeof item !== "string"))) {
    throw new Error(`O campo "${field}" deve ser uma lista de textos.`);
  }
}

function optionalPositiveInteger(input: JsonRecord, field: string, nullable = false) {
  const value = input[field];
  if (value === undefined || (nullable && value === null)) return;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new Error(`O campo "${field}" deve ser um inteiro maior ou igual a 1${nullable ? " ou nulo" : ""}.`);
  }
}

function optionalDate(input: JsonRecord, field: string, nullable = false) {
  const value = input[field];
  if (value === undefined || (nullable && value === null)) return;
  const datePart = typeof value === "string" ? value.slice(0, 10) : "";
  const isoDate = typeof value === "string"
    && /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?)?$/.test(value)
    && !Number.isNaN(Date.parse(value))
    && new Date(`${datePart}T00:00:00.000Z`).toISOString().startsWith(datePart);
  if (!isoDate) {
    throw new Error(`O campo "${field}" deve ser uma data válida${nullable ? " ou nulo" : ""}.`);
  }
}

function validateListFilters(input: JsonRecord) {
  ensureOnlyFields(input, LIST_FIELDS);
  for (const field of ["electionId", "electoralZoneId", "pollingPlaceId", "assigneeId", "labelId", "milestoneId"]) {
    optionalString(input, field);
  }
  optionalEnum(input, "status", TASK_STATUSES);
  optionalEnum(input, "priority", TASK_PRIORITIES);
  optionalEnum(input, "executionMode", TASK_EXECUTION_MODES);
  optionalString(input, "search", { maxLength: 160 });
  if (input.overdue !== undefined && typeof input.overdue !== "boolean") {
    throw new Error('O campo "overdue" deve ser booleano.');
  }
}

function validateCreateTask(input: JsonRecord) {
  ensureOnlyFields(input, CREATE_FIELDS);
  const title = requiredString(input, "title");
  if (title.length < 2 || title.length > 180) {
    throw new Error('O campo "title" deve ter entre 2 e 180 caracteres.');
  }
  requiredString(input, "electionId");
  for (const field of ["description", "electoralZoneId", "pollingPlaceId", "assigneeId", "parentId"]) {
    optionalString(input, field, field === "description" ? { maxLength: 5000 } : {});
  }
  optionalEnum(input, "priority", TASK_PRIORITIES);
  optionalEnum(input, "executionMode", TASK_EXECUTION_MODES);
  optionalPositiveInteger(input, "requiredTeamSize", true);
  optionalStringArray(input, "requiredSpecialtyIds");
  optionalDate(input, "dueAt");
}

function validateUpdateTask(input: JsonRecord) {
  ensureOnlyFields(input, Object.keys(updateTaskSchema.properties));
  requiredString(input, "id");
  if (!UPDATE_FIELDS.some((field) => input[field] !== undefined)) {
    throw new Error("Informe pelo menos um campo alterável além do identificador.");
  }
  const title = input.title;
  if (title !== undefined && (typeof title !== "string" || title.length < 2 || title.length > 180)) {
    throw new Error('O campo "title" deve ter entre 2 e 180 caracteres.');
  }
  for (const field of ["description", "electionId", "electoralZoneId", "pollingPlaceId", "assigneeId", "milestoneId"]) {
    optionalString(input, field, {
      nullable: ["description", "electoralZoneId", "pollingPlaceId", "assigneeId", "milestoneId"].includes(field),
      ...(field === "description" ? { maxLength: 5000 } : {}),
    });
  }
  optionalEnum(input, "priority", TASK_PRIORITIES);
  optionalEnum(input, "status", TASK_STATUSES);
  optionalEnum(input, "executionMode", TASK_EXECUTION_MODES);
  optionalPositiveInteger(input, "requiredTeamSize", true);
  optionalStringArray(input, "requiredSpecialtyIds");
  optionalStringArray(input, "labelIds");
  optionalDate(input, "dueAt", true);
}

function apiErrorMessage(body: unknown) {
  if (!isRecord(body)) return undefined;
  const message = body.message;
  if (typeof message === "string") return message.slice(0, 500);
  if (Array.isArray(message) && message.every((item) => typeof item === "string")) {
    return message.join("; ").slice(0, 500);
  }
  return undefined;
}

async function requestApi(
  config: TaskApiConfig,
  path: string,
  init: RequestInit,
  fetchImpl: FetchFunction,
) {
  const apiUrl = new URL(config.apiUrl);
  const configuredPath = apiUrl.pathname.replace(/\/+$/, "");
  const apiPath = configuredPath.endsWith("/api") ? configuredPath : `${configuredPath}/api`;
  const endpointPath = path.replace(/^\/+/, "");
  const requestUrl = new URL(`${apiPath}/${endpointPath}`, apiUrl.origin).toString();
  let response: Response;
  try {
    response = await fetchImpl(requestUrl, {
      ...init,
      redirect: "error",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${config.token}`,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new Error("Não foi possível conectar à API da Central de Tarefas.");
  }

  let rawBody: string;
  try {
    rawBody = await response.text();
  } catch {
    throw new Error("Não foi possível ler a resposta da API da Central de Tarefas.");
  }
  let body: unknown;
  if (rawBody) {
    try {
      body = JSON.parse(rawBody) as unknown;
    } catch {
      body = undefined;
    }
  }
  if (!response.ok) {
    const isTaskCollection = path.split("?")[0] === "/tasks";
    const statusMessage: Record<number, string> = {
      400: "A API rejeitou os dados enviados.",
      401: "A API não autenticou o token configurado.",
      403: "O token não possui a permissão necessária.",
      404: isTaskCollection
        ? "A rota da Central de Tarefas não foi encontrada. Verifique a URL da API configurada."
        : "A tarefa solicitada não foi encontrada.",
      422: "A API rejeitou os dados por validação.",
    };
    throw new Error(apiErrorMessage(body) ?? statusMessage[response.status] ?? `A API respondeu com HTTP ${response.status}.`);
  }
  if (!rawBody) return null;
  if (body === undefined) throw new Error("A API retornou uma resposta em formato inválido.");
  return body;
}

function successResult(value: unknown): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(value) }],
    structuredContent: { result: value },
  };
}

function errorResult(error: unknown): CallToolResult {
  const message = error instanceof Error ? error.message : "Falha inesperada ao processar a ferramenta.";
  const errorObject = { message };
  return {
    content: [{ type: "text", text: JSON.stringify({ error: errorObject }) }],
    structuredContent: { error: errorObject },
    isError: true,
  };
}

export function listTaskTools() {
  return taskTools;
}

export async function executeTaskTool(
  name: string,
  args: unknown,
  config: TaskApiConfig,
  fetchImpl: FetchFunction = fetch,
): Promise<CallToolResult> {
  try {
    if (!isRecord(args)) throw new Error("Os argumentos da ferramenta devem ser um objeto.");

    let result: unknown;
    switch (name) {
      case "listar_tarefas": {
        validateListFilters(args);
        const query = new URLSearchParams();
        for (const [key, value] of Object.entries(args)) {
          if (value !== undefined) query.set(key, String(value));
        }
        const suffix = query.size > 0 ? `?${query.toString()}` : "";
        result = await requestApi(config, `/tasks${suffix}`, { method: "GET" }, fetchImpl);
        break;
      }
      case "consultar_tarefa": {
        ensureOnlyFields(args, ["id"]);
        const id = encodeURIComponent(requiredString(args, "id"));
        result = await requestApi(config, `/tasks/${id}`, { method: "GET" }, fetchImpl);
        break;
      }
      case "criar_tarefa": {
        validateCreateTask(args);
        result = await requestApi(
          config,
          "/tasks",
          { method: "POST", body: JSON.stringify(args) },
          fetchImpl,
        );
        break;
      }
      case "atualizar_tarefa": {
        validateUpdateTask(args);
        const id = encodeURIComponent(requiredString(args, "id"));
        const updates = { ...args };
        delete updates.id;
        result = await requestApi(
          config,
          `/tasks/${id}`,
          { method: "PATCH", body: JSON.stringify(updates) },
          fetchImpl,
        );
        break;
      }
      default:
        throw new Error(`Ferramenta desconhecida: ${name}.`);
    }

    return successResult(result);
  } catch (error) {
    return errorResult(error);
  }
}
