import { expect, test } from "@playwright/test";
import {
  apiGet,
  apiPatch,
  apiPost,
  apiPut,
  currentUser,
  resolveIncident,
  seed,
  statusOf,
  uniqueSuffix,
} from "../helpers/api";

/**
 * E2E-3 — Incidente → resolução → Postmortem → import de timeline → causa raiz
 * → lição → ação corretiva → review → aprovação → publicação.
 */

interface Postmortem {
  id: string;
  code: string;
  status: string;
  publishedAt?: string | null;
  reviewId?: string;
}

interface ImportResult {
  imported: number;
  skipped: number;
}

test.describe("postmortem: análise causal até a publicação", () => {
  // Fluxo longo: incidente, postmortem, timeline, causas, lições, ações, review e publicação.
  test.describe.configure({ timeout: 300_000 });

  test("percorre o ciclo com pré-condições, import idempotente e review", async ({
    request,
  }) => {
    const suffix = uniqueSuffix();
    const context = await seed(request);

    // 1. Incidente resolvido é o único elegível para postmortem.
    const incident = await apiPost<{ id: string; code: string }>(request, "admin", "/incidents", {
      title: `Falha de conectividade ${suffix}`,
      description: "Incidente criado pela suíte E2E de postmortem.",
      severity: "CRITICAL",
      electionId: context.electionId,
      electoralZoneId: context.zoneId,
      pollingPlaceId: context.placeId,
      categoryId: context.incidentCategoryId,
    });

    const blocked = await statusOf(request, "admin", "POST", "/postmortems", {
      primaryIncidentId: incident.id,
      title: `Análise bloqueada ${suffix}`,
    });
    expect(blocked, "incidente ainda aberto não pode receber postmortem").toBe(400);

    await resolveIncident(
      request,
      "admin",
      incident.id,
      "Enlace restabelecido pelo provedor.",
    );

    const postmortem = await apiPost<Postmortem>(request, "admin", "/postmortems", {
      primaryIncidentId: incident.id,
      title: `Análise do incidente ${incident.code}`,
    });
    expect(postmortem.status).toBe("DRAFT");

    // Um incidente aceita apenas um postmortem ativo.
    expect(
      await statusOf(request, "admin", "POST", "/postmortems", {
        primaryIncidentId: incident.id,
        title: `Análise duplicada ${suffix}`,
      }),
    ).toBe(409);

    // 2. Sem conteúdo mínimo, o envio para review é recusado.
    expect(
      await statusOf(request, "admin", "POST", `/postmortems/${postmortem.id}/submit-for-review`),
    ).toBe(400);

    // 3. Conteúdo estruturado.
    await apiPatch(request, "admin", `/postmortems/${postmortem.id}`, {
      executiveSummary: "Perda de conectividade com impacto direto na transmissão do local.",
      impactSummary: "Transmissão interrompida por quarenta minutos no local afetado.",
      detectionSummary: "Monitoramento de transmissão detectou a queda automaticamente.",
      responseSummary: "Provedor acionado e enlace de contingência preparado.",
      resolutionSummary: "Enlace primário substituído e serviço restabelecido.",
      rootCauseSummary: "Ausência de redundância ativa no enlace do local.",
    });

    // 4. Import de timeline idempotente.
    const firstImport = await apiPost<ImportResult>(
      request,
      "admin",
      `/postmortems/${postmortem.id}/timeline/import`,
      { includeIncidentEvents: true },
    );
    expect(firstImport.imported).toBeGreaterThan(0);

    const secondImport = await apiPost<ImportResult>(
      request,
      "admin",
      `/postmortems/${postmortem.id}/timeline/import`,
      { includeIncidentEvents: true },
    );
    expect(secondImport.imported, "reimportar não deve duplicar a timeline").toBe(0);
    expect(secondImport.skipped).toBe(firstImport.imported);

    // 5. Causa raiz, lição e ação corretiva (exigida para incidente CRITICAL).
    const rootCause = await apiPost<{ causes: Array<{ id: string; type: string }> }>(
      request,
      "admin",
      `/postmortems/${postmortem.id}/causes`,
      {
        type: "ROOT_CAUSE",
        category: "TECHNOLOGY",
        statement: "Enlace único sem contingência ativa no local.",
        evidence: "Histórico de conectividade do ponto registrou queda total.",
      },
    );
    const rootCauseId = rootCause.causes.find((cause) => cause.type === "ROOT_CAUSE")!.id;

    await apiPost(request, "admin", `/postmortems/${postmortem.id}/causes`, {
      type: "CONTRIBUTING_FACTOR",
      category: "PROCESS",
      statement: "Procedimento de validação de redundância não era executado.",
      parentId: rootCauseId,
    });

    await apiPost(request, "admin", `/postmortems/${postmortem.id}/lessons`, {
      type: "LESSON",
      title: "Redundância precisa ser testada, não apenas contratada",
      description: "O enlace de contingência existia, mas nunca havia sido validado em operação.",
      category: "PROCESS",
    });

    await apiPost(request, "admin", `/postmortems/${postmortem.id}/actions`, {
      title: "Validar enlace de contingência antes do pleito",
      description: "Executar teste de failover em todos os locais com enlace único.",
      priority: "HIGH",
      ownerUserId: (await currentUser(request, "admin")).id,
    });

    // 6. Review exige incidente elegível, resumos, causa, lição e ação — todos presentes.
    const supervisor = await currentUser(request, "supervisor");
    await apiPut(request, "admin", `/postmortems/${postmortem.id}/reviewers`, {
      userIds: [supervisor.id],
    });

    const inReview = await apiPost<Postmortem>(
      request,
      "admin",
      `/postmortems/${postmortem.id}/submit-for-review`,
    );
    expect(inReview.status).toBe("IN_REVIEW");

    // Publicar antes da aprovação é recusado.
    expect(
      await statusOf(request, "admin", "POST", `/postmortems/${postmortem.id}/publish`),
    ).toBe(409);

    // 7. Mudanças solicitadas devolvem o postmortem para ajuste.
    const changes = await apiPost<Postmortem>(
      request,
      "supervisor",
      `/postmortems/${postmortem.id}/reviews`,
      { decision: "CHANGES_REQUESTED", comment: "Detalhar o impacto por seção eleitoral." },
    );
    expect(changes.status).toBe("CHANGES_REQUESTED");

    await apiPatch(request, "admin", `/postmortems/${postmortem.id}`, {
      impactSummary: "Impacto detalhado: uma seção eleitoral sem transmissão por quarenta minutos.",
    });

    // 8. Reenvio preserva o histórico de review e converge para aprovação.
    const resubmitted = await apiPost<Postmortem>(
      request,
      "admin",
      `/postmortems/${postmortem.id}/submit-for-review`,
    );
    expect(resubmitted.status).toBe("IN_REVIEW");

    const approved = await apiPost<Postmortem>(
      request,
      "supervisor",
      `/postmortems/${postmortem.id}/reviews`,
      { decision: "APPROVED", comment: "Impacto detalhado de forma suficiente." },
    );
    expect(approved.status).toBe("APPROVED");

    // 9. Publicação registra carimbo e autor.
    const published = await apiPost<Postmortem>(
      request,
      "admin",
      `/postmortems/${postmortem.id}/publish`,
    );
    expect(published.status).toBe("PUBLISHED");
    expect(published.publishedAt).toBeTruthy();

    const detail = await apiGet<
      Postmortem & { reviews: Array<{ decision: string }>; timeline: unknown[] }
    >(request, "admin", `/postmortems/${postmortem.id}`);
    // Duas decisões foram registradas: mudanças solicitadas e, depois do reenvio,
    // aprovação. Reenviar não apaga a decisão anterior — é isso que se verifica.
    expect(detail.reviews.length, "histórico de reviews é preservado").toBe(2);
    expect(detail.reviews.some((review) => review.decision === "CHANGES_REQUESTED")).toBe(true);
    expect(detail.reviews.some((review) => review.decision === "APPROVED")).toBe(true);

    // 10. Insights de RCA passam a considerar a análise publicada.
    const insights = await apiGet<{
      sampleSize: number;
      publishedCount: number;
      causesByCategory: Array<{ key: string; count: number }>;
      actionItems: { open: number };
    }>(request, "admin", "/postmortems/insights");
    expect(insights.sampleSize).toBeGreaterThanOrEqual(1);
    expect(insights.publishedCount).toBeGreaterThanOrEqual(1);
    expect(insights.causesByCategory.some((row) => row.key === "TECHNOLOGY")).toBe(true);
  });
});
