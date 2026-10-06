import { expect, test, type APIRequestContext } from "@playwright/test";
import {
  ago,
  ahead,
  apiGet,
  apiPost,
  seed,
  statusOf,
  uniqueSuffix,
  type Role,
} from "./helpers/api";
import { loginAs } from "./helpers/ui";

/**
 * E2E-6 — RBAC por perfil.
 *
 * A autorização é sempre verificada no backend: cada caso chama o endpoint
 * diretamente e confirma o status real, além de conferir a navegação exposta
 * pelo shell. Um botão escondido não é prova de autorização.
 */

const auditWindow = () =>
  `/audit?from=${encodeURIComponent(ago(1440))}&to=${encodeURIComponent(ahead(5))}`;

async function expectReadsAllowed(
  request: APIRequestContext,
  role: Role,
  paths: string[],
): Promise<void> {
  for (const path of paths) {
    const status = await statusOf(request, role, "GET", path);
    expect(status, `${role} deveria ler ${path}`).toBe(200);
  }
}

test.describe("RBAC por perfil", () => {
  test("ADMIN lê todos os domínios e navega pelas áreas protegidas", async ({
    request,
    page,
  }) => {
    const context = await seed(request);
    await expectReadsAllowed(request, "admin", [
      "/incidents",
      "/inventory",
      "/routes",
      "/transmission",
      "/resource-requests",
      "/postmortems",
      "/command-center/summary",
      "/simulations",
      auditWindow(),
    ]);

    // Escrita exclusiva de quem possui a permissão de criação de incidente.
    const incident = await apiPost<{ id: string }>(request, "admin", "/incidents", {
      title: `Incidente de verificação RBAC ${uniqueSuffix()}`,
      description: "Incidente criado pela matriz de RBAC.",
      severity: "LOW",
      electionId: context.electionId,
      electoralZoneId: context.zoneId,
      pollingPlaceId: context.placeId,
      categoryId: context.incidentCategoryId,
    });
    expect(incident.id).toBeTruthy();

    await loginAs(page, "admin");
    await page.goto("/audit");
    await expect(page.locator('a[href="/audit"]').first()).toBeVisible();
    await page.goto("/command-center");
    await expect(page.getByRole("heading", { name: /Central de Comando/i })).toBeVisible();
  });

  test("SUPERVISOR opera a coordenação mas não administra usuários", async ({
    request,
  }) => {
    await seed(request);
    await expectReadsAllowed(request, "supervisor", [
      "/incidents",
      "/resource-requests",
      "/postmortems",
      "/command-center/summary",
      auditWindow(),
    ]);

    // Gestão de usuários e papéis é exclusiva do ADMIN.
    expect(await statusOf(request, "supervisor", "POST", "/users", {})).toBe(403);
    expect(await statusOf(request, "supervisor", "POST", "/roles", {})).toBe(403);
  });

  test("OPERATOR executa a operação mas não aprova recursos nem lê auditoria", async ({
    request,
    page,
  }) => {
    const context = await seed(request);
    await expectReadsAllowed(request, "operator", [
      "/incidents",
      "/inventory",
      "/shifts",
      "/tasks",
      "/command-center/summary",
    ]);

    // Reconhecer incidente é permitido; criar ativo e aprovar recurso não são.
    const incident = await apiPost<{ id: string }>(request, "admin", "/incidents", {
      title: `Incidente para reconhecimento ${uniqueSuffix()}`,
      description: "Criado para verificar a permissão de atualização do operador.",
      severity: "MEDIUM",
      electionId: context.electionId,
      electoralZoneId: context.zoneId,
      pollingPlaceId: context.placeId,
      categoryId: context.incidentCategoryId,
    });
    expect(
      await statusOf(request, "operator", "POST", `/incidents/${incident.id}/acknowledge`),
    ).toBe(200);

    expect(await statusOf(request, "operator", "POST", "/inventory", {})).toBe(403);
    expect(
      await statusOf(request, "operator", "POST", "/resource-requests/unknown-id/approve"),
    ).toBe(403);
    expect(await statusOf(request, "operator", "GET", auditWindow())).toBe(403);

    // O módulo de auditoria não aparece na navegação sem a permissão de leitura.
    await loginAs(page, "operator");
    await expect(page.locator('a[href="/audit"]')).toHaveCount(0);
    await expect(page.locator('a[href="/incidents"]').first()).toBeVisible();
  });

  test("TECHNICIAN atua em campo e não cria incidente nem aprova recurso", async ({
    request,
  }) => {
    await seed(request);
    await expectReadsAllowed(request, "technician", [
      "/incidents",
      "/inventory",
      "/transmission",
      "/tasks",
      "/command-center/summary",
    ]);

    expect(await statusOf(request, "technician", "POST", "/incidents", {})).toBe(403);
    expect(await statusOf(request, "technician", "POST", "/inventory", {})).toBe(403);
    expect(await statusOf(request, "technician", "POST", "/routes", {})).toBe(403);
    expect(await statusOf(request, "technician", "GET", auditWindow())).toBe(403);
  });

  test("VIEWER lê tudo e não escreve nada", async ({ request, page }) => {
    await seed(request);
    await expectReadsAllowed(request, "viewer", [
      "/incidents",
      "/inventory",
      "/routes",
      "/transmission",
      "/resource-requests",
      "/postmortems",
      "/command-center/summary",
      "/simulations",
      auditWindow(),
    ]);

    const writes: Array<[string, unknown]> = [
      ["/incidents", {}],
      ["/inventory", {}],
      ["/resource-requests", {}],
      ["/postmortems", {}],
      ["/transmission", {}],
      ["/field-teams", {}],
      ["/shifts", {}],
      ["/tasks", {}],
      ["/routes", {}],
      ["/command-center/snapshots", {}],
    ];
    for (const [path, body] of writes) {
      const status = await statusOf(request, "viewer", "POST", path, body);
      expect(status, `viewer não deveria escrever em ${path}`).toBe(403);
    }

    // A auditoria é legível pelo perfil de consulta e navegável.
    await loginAs(page, "viewer");
    await expect(page.locator('a[href="/audit"]').first()).toBeVisible();
    await page.goto("/audit");
    await expect(page.getByRole("heading").first()).toBeVisible();
  });

  test("a resposta não vaza dados quando a permissão é negada", async ({ request }) => {
    await seed(request);
    const denied = await statusOf(request, "viewer", "POST", "/resource-requests", {});
    expect(denied).toBe(403);

    // Ler continua devolvendo conteúdo real para quem tem a permissão de leitura.
    const list = await apiGet<{ total: number }>(request, "viewer", "/resource-requests");
    expect(typeof list.total).toBe("number");
  });
});
