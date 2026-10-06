import { describe, expect, it } from "vitest";
import type { DomainEvent } from "@eops/event-bus";
import { coordinationAudience } from "./notification.subscriber";

type SubscribedEventName =
  | "resource_request.submitted"
  | "resource_request.triaged"
  | "resource_request.approved"
  | "resource_request.rejected"
  | "resource_request.fulfilled"
  | "postmortem.submitted"
  | "postmortem.changes_requested"
  | "postmortem.approved"
  | "postmortem.published"
  | "postmortem.action_overdue";

function event<K extends SubscribedEventName>(
  name: K,
  payload: Record<string, unknown>,
): DomainEvent<K> {
  return {
    name,
    payload: payload as never,
    occurredAt: new Date("2026-10-06T12:00:00.000Z"),
  };
}

describe("audiência de solicitações de recurso", () => {
  it("deixa a submissão para quem possui a permissão de aprovação", () => {
    expect(
      coordinationAudience(
        event("resource_request.submitted", { actorId: "requester" }),
      ),
    ).toBeUndefined();
  });

  it("notifica apenas o responsável recém-designado", () => {
    expect(
      coordinationAudience(
        event("resource_request.triaged", {
          actorId: "triager",
          ownerId: "owner",
          ownerChanged: true,
        }),
      ),
    ).toEqual(["owner"]);
  });

  it("não notifica quando o triador designa a si mesmo", () => {
    expect(
      coordinationAudience(
        event("resource_request.triaged", {
          actorId: "owner",
          ownerId: "owner",
          ownerChanged: true,
        }),
      ),
    ).toEqual([]);
  });

  it("notifica o solicitante em aprovação, rejeição e atendimento", () => {
    for (const name of [
      "resource_request.approved",
      "resource_request.rejected",
      "resource_request.fulfilled",
    ] as const) {
      expect(
        coordinationAudience(
          event(name, { actorId: "approver", requestedById: "requester" }),
        ),
        name,
      ).toEqual(["requester"]);
    }
  });

  it("não notifica o próprio solicitante quando ele executa a ação", () => {
    expect(
      coordinationAudience(
        event("resource_request.approved", {
          actorId: "requester",
          requestedById: "requester",
        }),
      ),
    ).toEqual([]);
  });
});

describe("audiência de postmortem", () => {
  it("notifica todos os revisores designados na submissão", () => {
    expect(
      coordinationAudience(
        event("postmortem.submitted", {
          actorId: "owner",
          reviewerIds: ["r1", "r2"],
        }),
      ),
    ).toEqual(["r1", "r2"]);
  });

  it("notifica o responsável em mudanças solicitadas e aprovação", () => {
    for (const name of [
      "postmortem.changes_requested",
      "postmortem.approved",
    ] as const) {
      expect(
        coordinationAudience(event(name, { actorId: "reviewer", ownerId: "owner" })),
        name,
      ).toEqual(["owner"]);
    }
  });

  it("não notifica o reviewer que também é responsável", () => {
    expect(
      coordinationAudience(
        event("postmortem.approved", { actorId: "owner", ownerId: "owner" }),
      ),
    ).toEqual([]);
  });

  it("deduplica responsável e revisores na publicação e remove o ator", () => {
    expect(
      coordinationAudience(
        event("postmortem.published", {
          actorId: "owner",
          ownerId: "owner",
          reviewerIds: ["r1", "r2", "owner"],
        }),
      ),
    ).toEqual(["r1", "r2"]);
  });

  it("notifica o dono da ação corretiva vencida", () => {
    expect(
      coordinationAudience(
        event("postmortem.action_overdue", {
          actorId: "reader",
          ownerUserId: "action-owner",
        }),
      ),
    ).toEqual(["action-owner"]);
  });

  it("não notifica quando a ação vencida não tem responsável", () => {
    expect(
      coordinationAudience(
        event("postmortem.action_overdue", { actorId: "reader", ownerUserId: null }),
      ),
    ).toEqual([]);
  });
});
