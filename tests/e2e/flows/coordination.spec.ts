import { expect, test, type APIRequestContext } from "@playwright/test";
import {
  apiGet,
  apiPost,
  ahead,
  currentUser,
  resolveIncident,
  seed,
  uniqueSuffix,
} from "../helpers/api";
import { loginAs } from "../helpers/ui";

/**
 * E2E-1 — Incidente crítico → Command Center → Solicitação de recurso
 * (create, submit, triage, approve, atendimento parcial, atendimento total)
 * → Command Center atualizado.
 */

interface AttentionItem {
  id: string;
  sourceType: string;
  sourceId: string;
  severity: string;
  score: number;
}

interface AttentionResponse {
  health: string;
  criticalItems: AttentionItem[];
  warnings: AttentionItem[];
  sections: Record<string, { available: boolean }>;
}

interface RequestDetail {
  id: string;
  status: string;
  items: Array<{ id: string; quantity: number; fulfilledQuantity: number; remainingQuantity: number }>;
  totals: { totalRequired: number; totalFulfilled: number; fullySatisfied: boolean };
}

function feed(response: AttentionResponse): AttentionItem[] {
  return [...response.criticalItems, ...response.warnings];
}

function findItem(
  response: AttentionResponse,
  sourceType: string,
  sourceId: string,
): AttentionItem | undefined {
  return feed(response).find(
    (item) => item.sourceType === sourceType && item.sourceId === sourceId,
  );
}

test.describe("coordenação: do incidente crítico ao recurso atendido", () => {
  // Fluxo longo e cross-domain contra banco remoto com pool limitado: cada
  // leitura do Command Center agrega vários domínios. O teto padrão de 90s não
  // acomoda a sequência completa.
  test.describe.configure({ timeout: 240_000 });

  test("percorre o ciclo completo e reflete o estado no Command Center", async ({
    request,
  }) => {
    const suffix = uniqueSuffix();
    const context = await seed(request);
    const admin = await currentUser(request, "admin");

    // 1. Incidente crítico no escopo do pleito.
    const incident = await apiPost<{ id: string; code: string; title: string }>(
      request,
      "admin",
      "/incidents",
      {
        title: `Falha crítica de energia ${suffix}`,
        description: "Incidente criado pela suíte E2E de coordenação.",
        severity: "CRITICAL",
        electionId: context.electionId,
        electoralZoneId: context.zoneId,
        pollingPlaceId: context.placeId,
        categoryId: context.incidentCategoryId,
      },
    );
    expect(incident.code).toMatch(/^INC-/);

    const scope = { electionId: context.electionId, electoralZoneId: context.zoneId };

    // 2. O incidente aparece no feed agregado do Command Center.
    const afterIncident = await apiGet<AttentionResponse>(
      request,
      "admin",
      "/command-center/attention",
      scope,
    );
    expect(afterIncident.sections.incidents?.available).toBe(true);
    const incidentItem = findItem(afterIncident, "INCIDENT", incident.id);
    expect(incidentItem, "incidente crítico deve entrar no feed de atenção").toBeTruthy();
    expect(incidentItem!.severity).toBe("CRITICAL");

    // 3. Solicitação de recurso crítica nasce do incidente.
    const created = await apiPost<RequestDetail>(request, "admin", "/resource-requests", {
      electionId: context.electionId,
      electoralZoneId: context.zoneId,
      pollingPlaceId: context.placeId,
      incidentId: incident.id,
      title: `Apoio operacional para ${incident.code}`,
      description: "Gerador de contingência e apoio técnico solicitados pela suíte E2E.",
      priority: "CRITICAL",
      neededAt: ahead(120),
      items: [
        { kind: "MATERIAL", label: "Gerador de contingência", quantity: 2 },
        { kind: "TECH_SUPPORT", label: "Apoio técnico de campo", quantity: 1 },
      ],
    });
    expect(created.status).toBe("DRAFT");
    expect(created.items).toHaveLength(2);

    // 4. Submissão pelo próprio solicitante (o servidor usa o ator da sessão).
    expect(admin.id).toBeTruthy();
    const submitted = await apiPost<RequestDetail>(
      request,
      "admin",
      `/resource-requests/${created.id}/submit`,
    );
    expect(submitted.status).toBe("SUBMITTED");

    // 5. A solicitação crítica aberta também aparece no feed.
    const withRequest = await apiGet<AttentionResponse>(
      request,
      "admin",
      "/command-center/attention",
      scope,
    );
    expect(withRequest.sections.resourceRequests?.available).toBe(true);
    expect(
      findItem(withRequest, "RESOURCE_REQUEST", created.id),
      "solicitação crítica aberta deve entrar no feed",
    ).toBeTruthy();

    // 6. Triagem define responsável e prioridade, registrando histórico.
    const triaged = await apiPost<RequestDetail>(
      request,
      "admin",
      `/resource-requests/${created.id}/triage`,
      { ownerId: admin.id, priority: "HIGH", notes: "Assumido pela coordenação." },
    );
    expect(triaged.status).toBe("TRIAGED");

    // 7. Aprovação exige a permissão dedicada.
    const approved = await apiPost<RequestDetail>(
      request,
      "admin",
      `/resource-requests/${created.id}/approve`,
    );
    expect(approved.status).toBe("APPROVED");

    // 8. Atendimento parcial: um de dois geradores.
    // Os itens são resolvidos por rótulo: como nascem no mesmo lote, a ordem
    // retornada não é um contrato.
    const generator = approved.items.find(
      (item) => item.label === "Gerador de contingência",
    )!;
    const support = approved.items.find(
      (item) => item.label === "Apoio técnico de campo",
    )!;
    expect(generator.quantity).toBe(2);
    expect(support.quantity).toBe(1);
    const partial = await apiPost<RequestDetail>(
      request,
      "admin",
      `/resource-requests/${created.id}/fulfillments`,
      { requestItemId: generator.id, quantity: 1, notes: "Primeiro gerador entregue." },
    );
    expect(partial.status).toBe("PARTIALLY_FULFILLED");
    const partialGenerator = partial.items.find((item) => item.id === generator.id)!;
    expect(partialGenerator.fulfilledQuantity).toBe(1);
    expect(partialGenerator.remainingQuantity).toBe(1);
    expect(partial.totals.fullySatisfied).toBe(false);

    // 9. Completar o gerador não encerra a solicitação: o apoio técnico segue pendente.
    const stillPartial = await apiPost<RequestDetail>(
      request,
      "admin",
      `/resource-requests/${created.id}/fulfillments`,
      { requestItemId: generator.id, quantity: 1 },
    );
    expect(stillPartial.status).toBe("PARTIALLY_FULFILLED");

    // 10. O apoio técnico fecha o atendimento — derivado no servidor.
    const fulfilled = await apiPost<RequestDetail>(
      request,
      "admin",
      `/resource-requests/${created.id}/fulfillments`,
      { requestItemId: support.id, quantity: 1 },
    );
    expect(fulfilled.status).toBe("FULFILLED");
    expect(fulfilled.totals.totalFulfilled).toBe(fulfilled.totals.totalRequired);
    for (const item of fulfilled.items) expect(item.remainingQuantity).toBe(0);

    // 11. A solicitação atendida sai do feed; o incidente crítico continua.
    const afterFulfillment = await apiGet<AttentionResponse>(
      request,
      "admin",
      "/command-center/attention",
      scope,
    );
    expect(
      findItem(afterFulfillment, "RESOURCE_REQUEST", created.id),
      "solicitação encerrada não deve permanecer no feed",
    ).toBeFalsy();
    expect(findItem(afterFulfillment, "INCIDENT", incident.id)).toBeTruthy();

    // 12. Encerramento do incidente resolve o sinal crítico.
    await resolveIncident(
      request,
      "admin",
      incident.id,
      "Energia restabelecida pela equipe de campo.",
    );
    const afterResolution = await apiGet<AttentionResponse>(
      request,
      "admin",
      "/command-center/attention",
      scope,
    );
    expect(findItem(afterResolution, "INCIDENT", incident.id)).toBeFalsy();

    // 13. A solicitação permanece auditável com o histórico completo.
    const detail = await apiGet<RequestDetail & { history: Array<{ action: string }> }>(
      request,
      "admin",
      `/resource-requests/${created.id}`,
    );
    const actions = detail.history.map((entry) => entry.action);
    for (const expected of ["CREATED", "SUBMITTED", "TRIAGED", "APPROVED", "FULFILLED"]) {
      expect(actions, `histórico deve conter ${expected}`).toContain(expected);
    }

  });

  test("o feed de atenção do Command Center expõe o deep link do incidente", async ({
    request,
    page,
  }) => {
    const suffix = uniqueSuffix();
    const context = await seed(request);
    const incident = await apiPost<{ id: string; code: string }>(request, "admin", "/incidents", {
      title: `Interrupção de transmissão ${suffix}`,
      description: "Incidente criado para verificar o deep link no feed de atenção.",
      severity: "CRITICAL",
      electionId: context.electionId,
      electoralZoneId: context.zoneId,
      pollingPlaceId: context.placeId,
      categoryId: context.incidentCategoryId,
    });

    await loginAs(page, "admin");
    await page.goto("/command-center/attention");

    const deepLink = page.locator(`a[href="/incidents/${incident.id}"]`);
    await expect(deepLink.first()).toBeVisible();
    await expect(deepLink.first()).toContainText(incident.code);

    // O vínculo é navegável: leva ao detalhe real do incidente.
    await deepLink.first().click();
    await expect(page).toHaveURL(new RegExp(`/incidents/${incident.id}$`));

    // Limpeza: encerra o incidente para não poluir o ambiente compartilhado.
    await resolveIncident(
      request,
      "admin",
      incident.id,
      "Verificação de interface concluída.",
    );
  });
});
