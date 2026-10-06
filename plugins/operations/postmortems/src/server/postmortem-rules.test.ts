import { describe, expect, it } from "vitest";
import {
  POSTMORTEM_MAX_CAUSE_DEPTH,
  POSTMORTEM_TRANSITIONS,
  applyPostmortemReviews,
  availablePostmortemActions,
  canTransitionPostmortem,
  causeDepth,
  evaluatePostmortemApproval,
  isPostmortemActionOverdue,
  isPostmortemEditable,
  latestDecisions,
  postmortemCode,
  postmortemSubmitBlockers,
  requiresCorrectiveAction,
  validateCausePlacement,
  type PostmortemReviewEntry,
  type PostmortemStatus,
} from "@eops/shared/postmortems";

const ALL = Object.keys(POSTMORTEM_TRANSITIONS) as PostmortemStatus[];

describe("lifecycle de postmortem", () => {
  it("permite apenas as transições normativas", () => {
    const allowed: Array<[PostmortemStatus, PostmortemStatus]> = [
      ["DRAFT", "IN_REVIEW"],
      ["DRAFT", "ARCHIVED"],
      ["IN_REVIEW", "APPROVED"],
      ["IN_REVIEW", "CHANGES_REQUESTED"],
      ["IN_REVIEW", "ARCHIVED"],
      ["CHANGES_REQUESTED", "IN_REVIEW"],
      ["CHANGES_REQUESTED", "ARCHIVED"],
      ["APPROVED", "PUBLISHED"],
      ["APPROVED", "ARCHIVED"],
      ["PUBLISHED", "ARCHIVED"],
    ];
    for (const [from, to] of allowed)
      expect(canTransitionPostmortem(from, to), `${from}→${to}`).toBe(true);
  });

  it("proíbe regressão a partir de PUBLISHED e qualquer saída de ARCHIVED", () => {
    expect(canTransitionPostmortem("PUBLISHED", "DRAFT")).toBe(false);
    expect(canTransitionPostmortem("PUBLISHED", "CHANGES_REQUESTED")).toBe(false);
    expect(canTransitionPostmortem("APPROVED", "DRAFT")).toBe(false);
    expect(canTransitionPostmortem("IN_REVIEW", "DRAFT")).toBe(false);
    expect(POSTMORTEM_TRANSITIONS.ARCHIVED).toHaveLength(0);
    for (const status of ALL)
      expect(canTransitionPostmortem("ARCHIVED", status), status).toBe(false);
  });

  it("restringe edição a rascunho e mudanças solicitadas", () => {
    expect(isPostmortemEditable("DRAFT")).toBe(true);
    expect(isPostmortemEditable("CHANGES_REQUESTED")).toBe(true);
    for (const status of ["IN_REVIEW", "APPROVED", "PUBLISHED", "ARCHIVED"] as const)
      expect(isPostmortemEditable(status), status).toBe(false);
  });

  it("gera código legível por ano", () => {
    expect(postmortemCode(2026, 42)).toBe("PM-2026-0042");
  });
});

describe("árvore de causas", () => {
  const tree = [
    { id: "root", parentId: null },
    { id: "level2", parentId: "root" },
    { id: "level3", parentId: "level2" },
    { id: "level4", parentId: "level3" },
    { id: "level5", parentId: "level4" },
  ];

  it("calcula profundidade a partir da raiz", () => {
    expect(causeDepth("root", tree)).toBe(1);
    expect(causeDepth("level3", tree)).toBe(3);
    expect(causeDepth("level5", tree)).toBe(POSTMORTEM_MAX_CAUSE_DEPTH);
  });

  it("aceita causa raiz sem superior", () => {
    expect(validateCausePlacement(null, tree)).toBeNull();
  });

  it("rejeita superior inexistente", () => {
    expect(validateCausePlacement("missing", tree)).not.toBeNull();
  });

  it("rejeita ultrapassar a profundidade máxima", () => {
    expect(validateCausePlacement("level5", tree)).not.toBeNull();
    expect(validateCausePlacement("level4", tree)).toBeNull();
  });

  it("detecta ciclo ao percorrer a cadeia", () => {
    const cyclic = [
      { id: "a", parentId: "b" },
      { id: "b", parentId: "a" },
    ];
    expect(causeDepth("a", cyclic)).toBe(Number.POSITIVE_INFINITY);
  });
});

describe("pré-condições de submissão", () => {
  const filled = {
    incidentStatus: "RESOLVED",
    severity: "MEDIUM",
    executiveSummary: "resumo",
    impactSummary: "impacto",
    rootCauseSummary: "causa",
    rootCauseCount: 1,
    lessonCount: 1,
    actionCount: 0,
    reviewerCount: 1,
  };

  it("aprova quando todos os requisitos estão presentes", () => {
    expect(postmortemSubmitBlockers(filled)).toEqual([]);
  });

  it("exige incidente resolvido ou encerrado", () => {
    expect(
      postmortemSubmitBlockers({ ...filled, incidentStatus: "IN_PROGRESS" }),
    ).toContain("O incidente primário precisa estar resolvido ou encerrado.");
    expect(
      postmortemSubmitBlockers({ ...filled, incidentStatus: undefined }),
    ).toContain("Incidente primário não encontrado.");
  });

  it("exige resumos e ao menos uma causa raiz estruturada", () => {
    const blockers = postmortemSubmitBlockers({
      ...filled,
      executiveSummary: "   ",
      impactSummary: null,
      rootCauseSummary: "",
      rootCauseCount: 0,
    });
    expect(blockers.length).toBeGreaterThanOrEqual(4);
  });

  it("exige ao menos uma lição aprendida e um revisor", () => {
    const blockers = postmortemSubmitBlockers({
      ...filled,
      lessonCount: 0,
      reviewerCount: 0,
    });
    expect(blockers).toContain("Registre ao menos uma lição aprendida.");
    expect(blockers).toContain("Designe ao menos um revisor.");
  });

  it("exige ação corretiva em incidente HIGH ou CRITICAL", () => {
    expect(requiresCorrectiveAction("HIGH")).toBe(true);
    expect(requiresCorrectiveAction("CRITICAL")).toBe(true);
    expect(requiresCorrectiveAction("MEDIUM")).toBe(false);
    expect(
      postmortemSubmitBlockers({ ...filled, severity: "CRITICAL" }),
    ).toContain("Incidentes HIGH/CRITICAL exigem ao menos uma ação corretiva.");
    expect(
      postmortemSubmitBlockers({ ...filled, severity: "CRITICAL", actionCount: 1 }),
    ).toEqual([]);
  });
});

describe("workflow de review", () => {
  const review = (
    reviewerId: string,
    decision: "APPROVED" | "CHANGES_REQUESTED",
    at: string,
  ): PostmortemReviewEntry => ({ reviewerId, decision, createdAt: at });

  it("usa a decisão mais recente de cada revisor", () => {
    const decisions = latestDecisions([
      review("r1", "CHANGES_REQUESTED", "2026-10-06T10:00:00.000Z"),
      review("r1", "APPROVED", "2026-10-06T12:00:00.000Z"),
    ]);
    expect(decisions.get("r1")).toBe("APPROVED");
  });

  it("aprova somente quando todos os revisores aprovaram", () => {
    const reviews = [
      review("r1", "APPROVED", "2026-10-06T10:00:00.000Z"),
      review("r2", "APPROVED", "2026-10-06T11:00:00.000Z"),
    ];
    expect(evaluatePostmortemApproval(["r1", "r2"], reviews)).toEqual({
      approved: true,
      pendingReviewerIds: [],
      changesRequestedBy: [],
    });
  });

  it("mantém pendente enquanto houver revisor sem decisão", () => {
    const result = evaluatePostmortemApproval(
      ["r1", "r2"],
      [review("r1", "APPROVED", "2026-10-06T10:00:00.000Z")],
    );
    expect(result.approved).toBe(false);
    expect(result.pendingReviewerIds).toEqual(["r2"]);
  });

  it("preserva o histórico e considera a decisão mais recente após reenvio", () => {
    const reviews = [
      review("r1", "CHANGES_REQUESTED", "2026-10-06T09:00:00.000Z"),
      review("r1", "APPROVED", "2026-10-06T13:00:00.000Z"),
      review("r2", "CHANGES_REQUESTED", "2026-10-06T14:00:00.000Z"),
    ];
    const result = evaluatePostmortemApproval(["r1", "r2"], reviews);
    expect(result.approved).toBe(false);
    expect(result.changesRequestedBy).toEqual(["r2"]);
    expect(reviews).toHaveLength(3);
  });

  it("não aprova sem revisores designados", () => {
    expect(evaluatePostmortemApproval([], []).approved).toBe(false);
  });

  it("aplica a decisão à timeline de reviews", () => {
    const timeline = applyPostmortemReviews(
      ["r1", "r2"],
      [review("r1", "CHANGES_REQUESTED", "2026-10-06T09:00:00.000Z")],
      review("r2", "APPROVED", "2026-10-06T15:00:00.000Z"),
    );
    expect(timeline).toHaveLength(2);
    expect(timeline[1]).toMatchObject({ reviewerId: "r2", decision: "APPROVED" });
  });
});

describe("ações corretivas", () => {
  const now = new Date("2026-10-06T12:00:00.000Z");

  it("marca vencida apenas ação aberta ou em andamento", () => {
    expect(
      isPostmortemActionOverdue(
        { status: "OPEN", dueAt: "2026-10-06T09:00:00.000Z" },
        now,
      ),
    ).toBe(true);
    expect(
      isPostmortemActionOverdue(
        { status: "IN_PROGRESS", dueAt: "2026-10-06T09:00:00.000Z" },
        now,
      ),
    ).toBe(true);
    expect(
      isPostmortemActionOverdue(
        { status: "DONE", dueAt: "2026-10-06T09:00:00.000Z" },
        now,
      ),
    ).toBe(false);
    expect(
      isPostmortemActionOverdue({ status: "OPEN", dueAt: null }, now),
    ).toBe(false);
  });
});

describe("availableActions", () => {
  const base = {
    createdById: "owner",
    ownerId: "owner",
    actorId: "owner",
    permissions: ["postmortems.manage"] as string[],
    isReviewer: false,
  };

  it("permite editar, submeter e importar em rascunho", () => {
    expect(availablePostmortemActions({ ...base, status: "DRAFT" })).toEqual([
      "edit",
      "submitForReview",
      "importTimeline",
      "archive",
    ]);
  });

  it("não oferece edição em IN_REVIEW ou PUBLISHED", () => {
    expect(
      availablePostmortemActions({ ...base, status: "IN_REVIEW" }),
    ).toEqual(["archive"]);
    expect(
      availablePostmortemActions({ ...base, status: "PUBLISHED" }),
    ).toEqual(["archive"]);
  });

  it("oferece review apenas ao revisor designado com permissão", () => {
    expect(
      availablePostmortemActions({
        ...base,
        status: "IN_REVIEW",
        actorId: "reviewer",
        permissions: ["postmortems.review"],
        isReviewer: true,
      }),
    ).toEqual(["review"]);
    expect(
      availablePostmortemActions({
        ...base,
        status: "IN_REVIEW",
        actorId: "reviewer",
        permissions: ["postmortems.review"],
        isReviewer: false,
      }),
    ).toEqual([]);
  });

  it("exige permissão de publicação para publicar aprovado", () => {
    expect(
      availablePostmortemActions({
        ...base,
        status: "APPROVED",
        actorId: "publisher",
        permissions: ["postmortems.publish"],
      }),
    ).toEqual(["publish"]);
  });
});
