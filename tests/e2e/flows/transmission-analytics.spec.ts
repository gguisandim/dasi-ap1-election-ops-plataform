import { expect, test } from "@playwright/test";
import {
  ahead,
  apiGet,
  apiPatch,
  apiPost,
  resolveIncident,
  seed,
  statusOf,
  uniqueSuffix,
} from "../helpers/api";
import { loginAs } from "../helpers/ui";

/**
 * E2E-5 — Degradação/queda de transmissão → sinal de atenção → incidente →
 * Command Center → failover → recuperação → analytics.
 */

interface TransmissionPoint {
  id: string;
  identification: string;
  connectivity: string;
  status: string;
}

interface Circuit {
  id: string;
  code: string;
  isPrimary: boolean;
  status: string;
}

interface Failover {
  id: string;
  status: string;
  toCircuitId: string;
  recoveredAt?: string | null;
}

interface StateTransition {
  id: string;
  from: string;
  to: string;
  durationSeconds: number | null;
}

interface PointSla {
  uptimePercent: number | null;
  downtimeMinutes: number;
  unknownMinutes: number;
  observedMinutes: number;
}

interface Correlation {
  incidents: { available: boolean; items?: Array<{ id: string }> };
}

test.describe("transmissão: queda, failover, recuperação e analytics", () => {
  // Fluxo longo: ponto, circuitos, provedor, histórico, correlação, failover,
  // recuperação, SLA, analytics e verificação de interface.
  test.describe.configure({ timeout: 300_000 });

  test("correlaciona a queda com o incidente e mede o SLA após a recuperação", async ({
    request,
    page,
  }) => {
    const suffix = uniqueSuffix();
    const context = await seed(request);

    // 1. Ponto de transmissão no local do pleito, com prazo operacional futuro.
    const point = await apiPost<TransmissionPoint>(request, "admin", "/transmission", {
      electionId: context.electionId,
      electoralZoneId: context.zoneId,
      pollingPlaceId: context.placeId,
      identification: `E2E-${suffix}`,
      connectivity: "ONLINE",
      status: "SUCCESS",
      priority: 1,
      operationalDeadline: ahead(60),
      observations: "Ponto criado pela suíte E2E de transmissão.",
    });

    const provider = await apiPost<{ id: string; code: string }>(
      request,
      "admin",
      "/transmission/providers",
      { code: `PRV-${suffix}`, name: `Provedor E2E ${suffix}`, contact: "noc@e2e.local" },
    );

    // 2. Link primário e link de contingência.
    const primary = await apiPost<Circuit>(
      request,
      "admin",
      `/transmission/${point.id}/circuits`,
      {
        code: `CIR-P-${suffix}`,
        name: "Enlace primário",
        technology: "FIBER",
        isPrimary: true,
        status: "ONLINE",
        providerId: provider.id,
      },
    );
    expect(primary.isPrimary).toBe(true);

    const backup = await apiPost<Circuit>(
      request,
      "admin",
      `/transmission/${point.id}/circuits`,
      {
        code: `CIR-B-${suffix}`,
        name: "Enlace de contingência",
        technology: "RADIO",
        isPrimary: false,
        status: "ONLINE",
        providerId: provider.id,
      },
    );

    // Segundo primário ativo no mesmo ponto é recusado pelo servidor.
    expect(
      await statusOf(request, "admin", "POST", `/transmission/${point.id}/circuits`, {
        code: `CIR-P2-${suffix}`,
        name: "Segundo primário",
        isPrimary: true,
        status: "ONLINE",
      }),
    ).toBe(409);

    // 3. Degradação registrada com histórico.
    await apiPatch(request, "admin", `/transmission/${point.id}/connectivity`, {
      connectivity: "DEGRADED",
      reason: "Latência elevada no provedor.",
    });
    const afterDegraded = await apiGet<StateTransition[] | { items: StateTransition[] }>(
      request,
      "admin",
      `/transmission/${point.id}/state-history`,
    );
    const degradedTransitions = Array.isArray(afterDegraded)
      ? afterDegraded
      : afterDegraded.items;
    expect(degradedTransitions.some((entry) => entry.to === "DEGRADED")).toBe(true);

    // 4. Queda total gera sinal de atenção no Command Center.
    await apiPatch(request, "admin", `/transmission/${point.id}/connectivity`, {
      connectivity: "OFFLINE",
      reason: "Rompimento do enlace primário.",
    });
    const attention = await apiGet<{
      criticalItems: Array<{ sourceType: string; sourceId: string }>;
      warnings: Array<{ sourceType: string; sourceId: string }>;
    }>(request, "admin", "/command-center/attention", {
      electionId: context.electionId,
    });
    expect(
      [...attention.criticalItems, ...attention.warnings].some(
        (item) => item.sourceType === "TRANSMISSION" && item.sourceId === point.id,
      ),
      "ponto offline deve aparecer no feed de atenção",
    ).toBe(true);

    // 5. Incidente aberto no mesmo local e correlacionado à queda.
    const incident = await apiPost<{ id: string; code: string }>(request, "admin", "/incidents", {
      title: `Perda de transmissão em ${context.placeName}`,
      description: "Queda detectada durante a suíte E2E de transmissão.",
      severity: "HIGH",
      electionId: context.electionId,
      electoralZoneId: context.zoneId,
      pollingPlaceId: context.placeId,
      categoryId: context.incidentCategoryId,
    });
    const correlation = await apiGet<Correlation>(request, "admin", "/transmission/correlation", {
      pointId: point.id,
      electionId: context.electionId,
    });
    expect(correlation.incidents.available).toBe(true);
    expect(
      correlation.incidents.items?.some((item) => item.id === incident.id),
      "correlação deve apontar o incidente do mesmo local",
    ).toBe(true);

    // 6. Failover para o enlace de contingência.
    const failover = await apiPost<Failover>(
      request,
      "admin",
      `/transmission/${point.id}/failover`,
      {
        fromCircuitId: primary.id,
        toCircuitId: backup.id,
        reason: "Enlace primário indisponível; contingência acionada.",
      },
    );
    expect(failover.status).toBe("ACTIVE");

    // Um segundo failover ativo no mesmo ponto é recusado.
    expect(
      await statusOf(request, "admin", "POST", `/transmission/${point.id}/failover`, {
        toCircuitId: primary.id,
        reason: "Tentativa concorrente de failover.",
      }),
    ).toBe(409);

    // 7. Recuperação fecha o failover e devolve o ponto à operação.
    const recovered = await apiPost<Failover>(
      request,
      "admin",
      `/transmission/${point.id}/failover/${failover.id}/recover`,
    );
    expect(recovered.status).toBe("RECOVERED");
    expect(recovered.recoveredAt).toBeTruthy();
    await apiPost(request, "admin", `/transmission/${point.id}/recovery`, {});

    const restored = await apiGet<TransmissionPoint>(
      request,
      "admin",
      `/transmission/${point.id}`,
    );
    expect(restored.connectivity).toBe("ONLINE");

    // 8. O sinal deixa de existir após a recuperação.
    const afterRecovery = await apiGet<{
      criticalItems: Array<{ sourceType: string; sourceId: string }>;
      warnings: Array<{ sourceType: string; sourceId: string }>;
    }>(request, "admin", "/command-center/attention", {
      electionId: context.electionId,
    });
    expect(
      [...afterRecovery.criticalItems, ...afterRecovery.warnings].some(
        (item) => item.sourceType === "TRANSMISSION" && item.sourceId === point.id,
      ),
    ).toBe(false);

    // 9. SLA do ponto considera o intervalo observado; UNKNOWN fica separado.
    const sla = await apiGet<PointSla>(request, "admin", `/transmission/${point.id}/sla`);
    expect(sla.observedMinutes).toBeGreaterThanOrEqual(0);
    expect(sla.unknownMinutes).toBeGreaterThanOrEqual(0);
    expect(sla.downtimeMinutes).toBeGreaterThan(0);
    if (sla.uptimePercent !== null) {
      expect(sla.uptimePercent).toBeGreaterThanOrEqual(0);
      expect(sla.uptimePercent).toBeLessThanOrEqual(100);
    }

    // 10. Analytics agregado responde com o histórico já registrado.
    const analytics = await apiGet<{ generatedAt: string; points?: unknown[] }>(
      request,
      "admin",
      "/transmission/analytics",
      { electionId: context.electionId },
    );
    expect(analytics.generatedAt).toBeTruthy();

    // 11. O detalhe do ponto é navegável e mostra a identificação real.
    await loginAs(page, "admin");
    await page.goto(`/transmission/${point.id}`);
    await expect(page.getByText(point.identification).first()).toBeVisible();

    // Limpeza: incidente encerrado para não deixar sinal aberto no ambiente.
    await resolveIncident(
      request,
      "admin",
      incident.id,
      "Verificação de transmissão concluída.",
    );
  });
});
