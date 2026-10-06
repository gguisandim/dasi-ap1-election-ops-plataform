import { expect, type APIRequestContext, type APIResponse } from "@playwright/test";

/**
 * Acesso à API pública da plataforma para os testes end-to-end.
 *
 * Os testes criam os próprios dados: o seed de demonstração não cobre rotas,
 * veículos, pontos de transmissão, tarefas e checklists, então depender dele
 * produziria testes frágeis. Somente entidades que a plataforma não expõe para
 * criação (pleito, zona, local de votação, usuário) são resolvidas por consulta.
 */

export const API_BASE = process.env.E2E_API_URL ?? "http://127.0.0.1:3001/api";

export const DEMO_PASSWORD = process.env.DEMO_ADMIN_PASSWORD ?? "DemoElectionOps2026!";

export const ROLE_EMAILS = {
  admin: "admin@eops.local",
  supervisor: "supervisor@eops.local",
  operator: "operator@eops.local",
  technician: "technician@eops.local",
  viewer: "viewer@eops.local",
} as const;

export type Role = keyof typeof ROLE_EMAILS;

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  permissions: string[];
}

interface Session {
  token: string;
  user: AuthenticatedUser;
}

const sessions = new Map<Role, Promise<Session>>();

/** Sessão autenticada por perfil, memoizada por processo do worker. */
export function session(request: APIRequestContext, role: Role): Promise<Session> {
  const cached = sessions.get(role);
  if (cached) return cached;
  const created = (async () => {
    const response = await request.post(`${API_BASE}/auth/login`, {
      data: { email: ROLE_EMAILS[role], password: DEMO_PASSWORD },
    });
    if (!response.ok()) {
      // Diagnóstico explícito: sem o status e o corpo, uma falha de login vira
      // um erro genérico impossível de distinguir de indisponibilidade do banco.
      throw new Error(
        `login de ${role} falhou: HTTP ${response.status()} ${await safeText(response)}`,
      );
    }
    const body = (await response.json()) as { token: string; user: AuthenticatedUser };
    return { token: body.token, user: body.user };
  })();
  sessions.set(role, created);
  return created;
}

export async function tokenFor(request: APIRequestContext, role: Role): Promise<string> {
  return (await session(request, role)).token;
}

export async function currentUser(
  request: APIRequestContext,
  role: Role,
): Promise<AuthenticatedUser> {
  return (await session(request, role)).user;
}

async function headers(request: APIRequestContext, role: Role) {
  return { Authorization: `Bearer ${await tokenFor(request, role)}` };
}

function withQuery(path: string, query?: Record<string, unknown>) {
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  const serialized = params.toString();
  return serialized ? `${path}?${serialized}` : path;
}

export async function apiGet<T>(
  request: APIRequestContext,
  role: Role,
  path: string,
  query?: Record<string, unknown>,
): Promise<T> {
  const response = await request.get(withQuery(`${API_BASE}${path}`, query), {
    headers: await headers(request, role),
  });
  expect(response.ok(), `GET ${path} → ${response.status()}`).toBeTruthy();
  return (await response.json()) as T;
}

export async function apiPost<T>(
  request: APIRequestContext,
  role: Role,
  path: string,
  data?: unknown,
): Promise<T> {
  const response = await request.post(`${API_BASE}${path}`, {
    headers: await headers(request, role),
    data: data ?? {},
  });
  expect(response.ok(), `POST ${path} → ${response.status()} ${await safeText(response)}`).toBeTruthy();
  return (await response.json()) as T;
}

export async function apiPatch<T>(
  request: APIRequestContext,
  role: Role,
  path: string,
  data?: unknown,
): Promise<T> {
  const response = await request.patch(`${API_BASE}${path}`, {
    headers: await headers(request, role),
    data: data ?? {},
  });
  expect(response.ok(), `PATCH ${path} → ${response.status()} ${await safeText(response)}`).toBeTruthy();
  return (await response.json()) as T;
}

export async function apiPut<T>(
  request: APIRequestContext,
  role: Role,
  path: string,
  data?: unknown,
): Promise<T> {
  const response = await request.put(`${API_BASE}${path}`, {
    headers: await headers(request, role),
    data: data ?? {},
  });
  expect(response.ok(), `PUT ${path} → ${response.status()} ${await safeText(response)}`).toBeTruthy();
  return (await response.json()) as T;
}

export async function apiDelete<T>(
  request: APIRequestContext,
  role: Role,
  path: string,
): Promise<T> {
  const response = await request.delete(`${API_BASE}${path}`, {
    headers: await headers(request, role),
  });
  expect(response.ok(), `DELETE ${path} → ${response.status()}`).toBeTruthy();
  return response.status() === 204 ? (undefined as T) : ((await response.json()) as T);
}

export async function apiPostMultipart<T>(
  request: APIRequestContext,
  role: Role,
  path: string,
  fields: Record<string, string>,
  file: { name: string; mimeType: string; buffer: Buffer },
): Promise<T> {
  const response = await request.post(`${API_BASE}${path}`, {
    headers: await headers(request, role),
    multipart: { ...fields, file },
  });
  expect(response.ok(), `POST ${path} (multipart) → ${response.status()} ${await safeText(response)}`).toBeTruthy();
  return (await response.json()) as T;
}

/** Chama um endpoint esperando uma falha e devolve o status real. */
export async function statusOf(
  request: APIRequestContext,
  role: Role,
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
  path: string,
  data?: unknown,
): Promise<number> {
  const response = await request.fetch(`${API_BASE}${path}`, {
    method,
    headers: await headers(request, role),
    data: method === "GET" || method === "DELETE" ? undefined : (data ?? {}),
  });
  return response.status();
}

async function safeText(response: APIResponse): Promise<string> {
  try {
    return (await response.text()).slice(0, 200);
  } catch {
    return "";
  }
}

/**
 * Encerra um incidente respeitando a tabela de transições do domínio.
 *
 * `NEW` não vai direto para `RESOLVED`: é preciso passar por um estado de
 * atendimento. O helper percorre o caminho mínimo em vez de assumir uma
 * transição que o servidor recusa — a regra é do domínio, não do teste.
 */
export async function resolveIncident(
  request: APIRequestContext,
  role: Role,
  incidentId: string,
  reason: string,
): Promise<void> {
  await apiPatch(request, role, `/incidents/${incidentId}/status`, {
    status: "IN_PROGRESS",
  });
  await apiPost(request, role, `/incidents/${incidentId}/resolve`, { reason });
}

export interface SeedContext {
  electionId: string;
  electionName: string;
  zoneId: string;
  zoneName: string;
  placeId: string;
  placeName: string;
  assetTypeId: string;
  fieldRoleId: string;
  incidentCategoryId: string;
}

let seedContext: Promise<SeedContext> | undefined;

/**
 * Resolve as referências que a plataforma não expõe para criação.
 *
 * Usa endpoints de consulta única em vez de `/resource-requests/references`,
 * que dispara nove consultas paralelas: contra um banco com pool de conexões
 * limitado, essa concorrência esgota o pool e devolve 500 opaco. O contexto
 * resolvido aqui é o mesmo.
 */
export function seed(request: APIRequestContext, role: Role = "admin"): Promise<SeedContext> {
  seedContext ??= (async () => {
    const elections = await apiGet<Array<{ id: string; name: string }>>(
      request,
      role,
      "/elections",
    );
    const election = elections[0];
    expect(election, "o seed precisa ter ao menos um pleito").toBeTruthy();

    const zones = await apiGet<Array<{ id: string; name: string }>>(
      request,
      role,
      "/electoral-zones",
      { electionId: election.id },
    );
    const zone = zones[0];
    expect(zone, "o seed precisa ter uma zona no pleito").toBeTruthy();

    const places = await apiGet<{ items: Array<{ id: string; name: string }> }>(
      request,
      role,
      "/polling-places",
      { zoneId: zone.id, pageSize: 100 },
    );
    const place = places.items[0];
    expect(place, "o seed precisa ter um local na zona").toBeTruthy();

    const assetTypes = await apiGet<Array<{ id: string; name: string }>>(
      request,
      role,
      "/inventory/types",
    );
    expect(assetTypes[0], "o seed precisa ter um tipo de ativo").toBeTruthy();

    const roles = await apiGet<Array<{ id: string; active: boolean }>>(
      request,
      role,
      "/field-teams/roles",
    );
    const fieldRole = roles.find((item) => item.active) ?? roles[0];
    expect(fieldRole, "o seed precisa ter uma função de campo").toBeTruthy();

    const categories = await apiGet<Array<{ id: string; key: string }>>(
      request,
      role,
      "/incidents/categories",
    );
    expect(categories[0], "o seed precisa ter uma categoria de incidente").toBeTruthy();

    return {
      electionId: election.id,
      electionName: election.name,
      zoneId: zone.id,
      zoneName: zone.name,
      placeId: place.id,
      placeName: place.name,
      assetTypeId: assetTypes[0].id,
      fieldRoleId: fieldRole.id,
      incidentCategoryId: categories[0].id,
    };
  })();
  return seedContext;
}

let counter = 0;

/** Sufixo único para que execuções concorrentes não colidam em campos únicos. */
export function uniqueSuffix(): string {
  counter += 1;
  return `${Date.now().toString(36)}${counter.toString(36)}`;
}

/** Placa válida e única no formato aceito pelo domínio de rotas. */
export function uniquePlate(): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const letters = alphabet[Math.floor(Math.random() * 26)] + alphabet[Math.floor(Math.random() * 26)] + alphabet[Math.floor(Math.random() * 26)];
  const digits = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
  return `${letters}${digits.slice(0, 1)}${digits.slice(1)}`.slice(0, 7);
}

export function ago(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

export function ahead(minutes: number): string {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

export async function withRole(
  request: APIRequestContext,
  role: Role,
  fn: (token: string) => Promise<void>,
): Promise<void> {
  await fn(await tokenFor(request, role));
}
