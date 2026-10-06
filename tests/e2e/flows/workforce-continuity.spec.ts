import { expect, test } from "@playwright/test";
import {
  ago,
  ahead,
  apiGet,
  apiPatch,
  apiPost,
  currentUser,
  seed,
  statusOf,
  uniqueSuffix,
} from "../helpers/api";

/**
 * E2E-2 — Turno → operador indisponível → problema de cobertura → substituição
 * → dispatch → passagem de turno (submit, confirm).
 */

interface ShiftCoverage {
  items: Array<{
    shiftId: string;
    coverage: { state: string; availableOperators: number; requiredOperators: number; absent: number };
  }>;
}

interface Handover {
  id: string;
  status: string;
  recipientUserId: string;
}

interface Continuity {
  available: boolean;
  pending?: number;
  recentlyConfirmed?: Array<{ id: string; shiftName: string | null }>;
}

test.describe("continuidade: cobertura, substituição e passagem de turno", () => {
  // Fluxo longo: equipe, membros, turno, cobertura, ausência, dispatch, passagem e confirmação.
  test.describe.configure({ timeout: 300_000 });

  test("trata ausência, substitui o operador e confirma a passagem", async ({ request }) => {
    const suffix = uniqueSuffix();
    const context = await seed(request);

    // 1. Equipe própria para o fluxo — o seed não garante times livres.
    const team = await apiPost<{ id: string; name: string }>(request, "admin", "/field-teams", {
      name: `Equipe E2E ${suffix}`,
      code: `E2E-${suffix.toUpperCase().slice(-8)}`,
      electionId: context.electionId,
      responsibleName: "Coordenação E2E",
    });

    const member = await apiPost<{ id: string }>(request, "admin", "/field-teams/members", {
      teamId: team.id,
      roleId: context.fieldRoleId,
      name: `Operador E2E ${suffix}`,
    });
    const substitute = await apiPost<{ id: string }>(request, "admin", "/field-teams/members", {
      teamId: team.id,
      roleId: context.fieldRoleId,
      name: `Substituto E2E ${suffix}`,
    });

    // 2. Turno com dois postos exigidos e apenas um designado.
    const shift = await apiPost<{ id: string; name: string; status: string }>(
      request,
      "admin",
      "/shifts",
      {
        electionId: context.electionId,
        teamId: team.id,
        name: `Turno E2E ${suffix}`,
        startsAt: ago(30),
        endsAt: ahead(240),
        requiredOperators: 2,
        electoralZoneId: context.zoneId,
        pollingPlaceId: context.placeId,
        notes: "Turno criado pela suíte E2E de continuidade.",
      },
    );
    expect(shift.status).toBe("SCHEDULED");

    const assignment = await apiPost<{ id: string }>(
      request,
      "admin",
      `/shifts/${shift.id}/assignments`,
      { memberId: member.id },
    );

    // 3. Cobertura parcial: um de dois postos.
    const partial = await apiGet<ShiftCoverage>(request, "admin", "/shifts/coverage");
    const partialShift = partial.items.find((item) => item.shiftId === shift.id);
    expect(partialShift, "o turno recém-criado deve aparecer na cobertura").toBeTruthy();
    expect(partialShift!.coverage.availableOperators).toBe(1);
    expect(partialShift!.coverage.state).not.toBe("FULL");

    // 4. Ausência registrada esvazia a cobertura do turno.
    await apiPost(
      request,
      "admin",
      `/shifts/${shift.id}/assignments/${assignment.id}/absence`,
      { reason: "Operador indisponível por emergência familiar." },
    );
    const empty = await apiGet<ShiftCoverage>(request, "admin", "/shifts/coverage");
    const emptyShift = empty.items.find((item) => item.shiftId === shift.id)!;
    expect(emptyShift.coverage.availableOperators).toBe(0);
    expect(emptyShift.coverage.state).toBe("EMPTY");
    expect(emptyShift.coverage.absent).toBe(1);

    // 5. O Command Center reporta o turno sem cobertura como sinal de atenção.
    const workforce = await apiGet<{
      available: boolean;
      shifts: { coverageEmpty: number } | null;
    }>(request, "admin", "/command-center/workforce", {
      electionId: context.electionId,
    });
    expect(workforce.available).toBe(true);
    expect(workforce.shifts!.coverageEmpty).toBeGreaterThanOrEqual(1);

    const attention = await apiGet<{
      criticalItems: Array<{ sourceType: string; sourceId: string }>;
      warnings: Array<{ sourceType: string; sourceId: string }>;
    }>(request, "admin", "/command-center/attention", { electionId: context.electionId });
    const coverageSignal = [...attention.criticalItems, ...attention.warnings].find(
      (item) => item.sourceType === "SHIFT_COVERAGE" && item.sourceId === shift.id,
    );
    expect(coverageSignal, "turno sem cobertura deve gerar sinal").toBeTruthy();

    // 6. Substituir uma alocação já marcada como ausente é recusado pelo domínio
    //    como conflito com o estado atual — não como falha interna.
    expect(
      await statusOf(
        request,
        "admin",
        "POST",
        `/shifts/${shift.id}/assignments/${assignment.id}/replace`,
        { substituteMemberId: substitute.id, reason: "Tentativa sobre alocação ausente." },
      ),
      "alocação ausente não pode ser substituída",
    ).toBe(409);

    // 7. O caminho operacional real é designar o substituto como nova alocação.
    await apiPost(request, "admin", `/shifts/${shift.id}/assignments`, {
      memberId: substitute.id,
    });
    const replaced = await apiGet<ShiftCoverage>(request, "admin", "/shifts/coverage");
    const replacedShift = replaced.items.find((item) => item.shiftId === shift.id)!;
    expect(replacedShift.coverage.availableOperators).toBe(1);

    // 8. Turno iniciado e dispatch de campo acionado.
    await apiPost(request, "admin", `/shifts/${shift.id}/start`);
    const dispatch = await apiPost<{ id: string; status: string }>(
      request,
      "admin",
      "/field-teams/dispatches",
      {
        teamId: team.id,
        memberId: substitute.id,
        title: `Verificação de local ${suffix}`,
        priority: "HIGH",
        electoralZoneId: context.zoneId,
        pollingPlaceId: context.placeId,
      },
    );
    expect(dispatch.status).toBe("REQUESTED");
    const dispatched = await apiPatch<{ status: string }>(
      request,
      "admin",
      `/field-teams/dispatches/${dispatch.id}/status`,
      { status: "DISPATCHED" },
    );
    expect(dispatched.status).toBe("DISPATCHED");

    // 9. Passagem de turno para o operador demo — destinatário diferente do remetente.
    const operator = await currentUser(request, "operator");
    const admin = await currentUser(request, "admin");
    expect(operator.id).not.toBe(admin.id);

    const handover = await apiPost<Handover>(request, "admin", "/shift-handovers", {
      shiftId: shift.id,
      recipientUserId: operator.id,
      summary: `Turno ${suffix} encerrado com substituição registrada.`,
      pendingNotes: "Acompanhar o dispatch aberto no próximo turno.",
    });
    expect(handover.status).toBe("DRAFT");
    expect(handover.recipientUserId).toBe(operator.id);

    // 10. Submissão exige turno iniciado; só o remetente submete.
    const submitted = await apiPost<Handover>(
      request,
      "admin",
      `/shift-handovers/${handover.id}/submit`,
    );
    expect(submitted.status).toBe("PENDING_CONFIRMATION");

    // 11. A confirmação é do destinatário — o remetente recebe 403 do backend.
    expect(
      await statusOf(request, "admin", "POST", `/shift-handovers/${handover.id}/confirm`),
    ).toBe(403);

    const confirmed = await apiPost<Handover>(
      request,
      "operator",
      `/shift-handovers/${handover.id}/confirm`,
    );
    expect(confirmed.status).toBe("CONFIRMED");

    // 12. Continuidade no Command Center reflete a passagem confirmada.
    const continuity = await apiGet<Continuity>(
      request,
      "admin",
      "/command-center/continuity",
      { electionId: context.electionId },
    );
    expect(continuity.available).toBe(true);
    expect(continuity.recentlyConfirmed?.some((item) => item.id === handover.id)).toBe(true);
  });
});
