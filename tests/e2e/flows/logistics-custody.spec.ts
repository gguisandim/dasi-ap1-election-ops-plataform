import { expect, test } from "@playwright/test";
import {
  ahead,
  apiGet,
  apiPatch,
  apiPost,
  apiPostMultipart,
  seed,
  uniquePlate,
  uniqueSuffix,
} from "../helpers/api";

/**
 * E2E-4 — Inventário → reserva de ativo → rota → execução de parada → entrega →
 * evidência → custódia (check-out/check-in) → histórico.
 */

interface Asset {
  id: string;
  assetTag: string;
  status: string;
  condition: string;
}

interface Reservation {
  id: string;
  status: string;
}

interface Route {
  id: string;
  code: string;
  stops: Array<{ id: string; status: string }>;
  deliveries: Array<{ id: string; status: string; receiverName?: string | null }>;
  history: Array<{ id: string; type: string }>;
}

interface AssetDetail {
  id: string;
  status: string;
  assignments: Array<{ id: string; returnedAt?: string | null; purpose?: string | null }>;
}

test.describe("logística: reserva, rota, entrega e custódia do ativo", () => {
  // Fluxo longo: ativo, reserva, veículo, rota, paradas, entrega, evidência e custódia.
  test.describe.configure({ timeout: 300_000 });

  test("mantém a trilha completa do ativo até o retorno", async ({ request }) => {
    const suffix = uniqueSuffix();
    const context = await seed(request);

    // 1. Ativo próprio, para não disputar recursos semeados.
    const asset = await apiPost<Asset>(request, "admin", "/inventory", {
      assetTag: `E2E-${suffix.toUpperCase()}`.slice(0, 40),
      name: `Urna de contingência ${suffix}`,
      typeId: context.assetTypeId,
      electoralZoneId: context.zoneId,
      pollingPlaceId: context.placeId,
      status: "AVAILABLE",
      condition: "GOOD",
    });
    expect(asset.status).toBe("AVAILABLE");

    // 2. Reserva aprovada antes do uso operacional.
    const reservation = await apiPost<Reservation>(
      request,
      "admin",
      "/inventory/reservations",
      {
        assetId: asset.id,
        requesterName: "Coordenação E2E",
        purpose: "Uso na rota de distribuição da suíte E2E.",
        startsAt: ahead(-5),
        endsAt: ahead(180),
      },
    );
    expect(reservation.status).toBe("REQUESTED");
    const approved = await apiPost<Reservation>(
      request,
      "admin",
      `/inventory/reservations/${reservation.id}/approve`,
      { notes: "Reserva aprovada para a janela solicitada." },
    );
    expect(approved.status).toBe("APPROVED");

    // 3. Veículo e rota com parada no local do pleito.
    const vehicle = await apiPost<{ id: string }>(request, "admin", "/routes/vehicles", {
      identification: `VEIC-${suffix}`.slice(0, 40),
      plate: uniquePlate(),
      model: "Furgão de carga E2E",
      status: "AVAILABLE",
    });

    const route = await apiPost<Route>(request, "admin", "/routes", {
      code: `RT-${suffix.toUpperCase()}`.slice(0, 30),
      name: `Rota E2E ${suffix}`,
      electionId: context.electionId,
      electoralZoneId: context.zoneId,
      originName: "Centro de distribuição E2E",
      destinationName: context.placeName,
      plannedDeparture: ahead(10),
      plannedArrival: ahead(70),
      responsibleName: "Logística E2E",
      // A liberação da rota exige motorista informado (regra do domínio).
      driverName: "Motorista E2E",
      vehicleId: vehicle.id,
      stops: [
        {
          order: 1,
          pollingPlaceId: context.placeId,
          description: "Entrega de urna de contingência",
          eta: ahead(60),
        },
      ],
    });
    expect(route.stops).toHaveLength(1);
    const stopId = route.stops[0].id;

    // 4. Entrega com item vinculado ao ativo reservado. Precisa existir antes de
    //    a rota ser liberada: o domínio exige ao menos uma entrega para avançar.
    const delivery = await apiPost<{ id: string; status: string }>(
      request,
      "admin",
      "/routes/deliveries",
      {
        routeId: route.id,
        pollingPlaceId: context.placeId,
        items: [
          {
            assetId: asset.id,
            description: "Urna de contingência",
            quantity: 1,
          },
        ],
      },
    );
    expect(delivery.status).toBe("PENDING");

    // 5. Execução da rota: planejada → pronta → despachada → em andamento.
    for (const status of ["READY", "DISPATCHED", "IN_PROGRESS"]) {
      await apiPost(request, "admin", `/routes/${route.id}/transition`, { status });
    }

    // 6. A evidência comprova o recebimento e fica vinculada ao pleito.
    const evidence = await apiPostMultipart<{ id: string; code: string }>(
      request,
      "admin",
      "/evidence",
      {
        title: `Comprovante de entrega ${suffix}`,
        description: "Recibo assinado pelo responsável do local.",
        type: "RECEIPT",
        electionId: context.electionId,
        origin: "Rota E2E",
      },
      {
        name: "recibo.txt",
        mimeType: "text/plain",
        buffer: Buffer.from(`Recibo da entrega ${suffix}`),
      },
    );
    const evidenceDetail = await apiGet<{ id: string; versions: unknown[] }>(
      request,
      "admin",
      `/evidence/${evidence.id}`,
    );
    expect(evidenceDetail.id).toBe(evidence.id);

    const delivered = await apiPatch<{ status: string }>(
      request,
      "admin",
      `/routes/deliveries/${delivery.id}`,
      {
        status: "DELIVERED",
        receiverName: "Responsável do local",
        notes: "Entrega conferida e assinada.",
      },
    );
    expect(delivered.status).toBe("DELIVERED");

    // 7. Parada concluída e rota encerrada.
    await apiPost(
      request,
      "admin",
      `/routes/${route.id}/stops/${stopId}/action`,
      { status: "ARRIVED" },
    );
    await apiPost(
      request,
      "admin",
      `/routes/${route.id}/stops/${stopId}/action`,
      { status: "COMPLETED" },
    );
    await apiPost(request, "admin", `/routes/${route.id}/transition`, {
      status: "COMPLETED",
    });

    // 8. Custódia: retirada do ativo vinculada à reserva aprovada.
    await apiPost(request, "admin", `/inventory/${asset.id}/check-out`, {
      reservationId: reservation.id,
      responsibleName: "Logística E2E",
      purpose: "Transporte até o local para substituição de urna.",
      origin: "Centro de distribuição E2E",
      destination: context.placeName,
      conditionOut: "GOOD",
      notes: "Ativo entregue em perfeito estado.",
    });
    const inCustody = await apiGet<AssetDetail>(request, "admin", `/inventory/${asset.id}`);
    expect(inCustody.assignments.length).toBeGreaterThanOrEqual(1);
    expect(inCustody.assignments.some((entry) => entry.returnedAt === null)).toBe(true);

    // 9. Devolução encerra a custódia.
    await apiPost(request, "admin", `/inventory/${asset.id}/check-in`, {
      conditionIn: "GOOD",
      returnedTo: "Centro de distribuição E2E",
      receivedByName: "Conferente E2E",
      notes: "Ativo devolvido sem avaria.",
    });
    const returned = await apiGet<AssetDetail>(request, "admin", `/inventory/${asset.id}`);
    expect(returned.assignments.every((entry) => entry.returnedAt !== null)).toBe(true);

    // 10. A rota mantém o histórico auditável da execução.
    const routeDetail = await apiGet<Route>(request, "admin", `/routes/${route.id}`);
    expect(routeDetail.history.length).toBeGreaterThan(0);
    expect(routeDetail.deliveries[0].status).toBe("DELIVERED");
    expect(routeDetail.stops[0].status).toBe("COMPLETED");
  });
});
