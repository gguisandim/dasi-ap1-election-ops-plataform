import { describe, expect, it } from "vitest";
import {
  linkAllowedForKind,
  missingOperationalLink,
  validateAssetEligibility,
  validateFulfillmentQuantity,
  validateItemQuantity,
  validateItemReferences,
  validateReservationBinding,
  validateRouteEligibility,
  validateTeamEligibility,
  validateVehicleEligibility,
} from "./fulfillment-rules";
import {
  allowedFulfillmentSourceStatus,
  statusWithoutFulfillment,
} from "./resource-requests.service";

describe("elegibilidade de ativo", () => {
  it("rejeita ativos perdidos, baixados e em manutenção", () => {
    for (const status of ["LOST", "RETIRED", "MAINTENANCE"])
      expect(validateAssetEligibility({ status }), status).not.toBeNull();
  });

  it("aceita ativos em uso operacional", () => {
    for (const status of ["AVAILABLE", "ALLOCATED", "IN_USE", "IN_TRANSIT"])
      expect(validateAssetEligibility({ status }), status).toBeNull();
  });

  it("rejeita ativo indisponível por condição", () => {
    expect(
      validateAssetEligibility({ status: "AVAILABLE", condition: "UNAVAILABLE" }),
    ).not.toBeNull();
  });

  it("rejeita ativo inexistente", () => {
    expect(validateAssetEligibility(null)).not.toBeNull();
  });
});

describe("vínculo de reserva", () => {
  it("rejeita reserva de outro ativo", () => {
    expect(
      validateReservationBinding({ assetId: "asset-2", status: "APPROVED" }, "asset-1"),
    ).not.toBeNull();
  });

  it("rejeita reserva cancelada ou já atendida", () => {
    expect(
      validateReservationBinding({ assetId: "asset-1", status: "CANCELLED" }, "asset-1"),
    ).not.toBeNull();
    expect(
      validateReservationBinding({ assetId: "asset-1", status: "FULFILLED" }, "asset-1"),
    ).not.toBeNull();
  });

  it("aceita reserva solicitada ou aprovada do próprio ativo", () => {
    expect(
      validateReservationBinding({ assetId: "asset-1", status: "REQUESTED" }, "asset-1"),
    ).toBeNull();
    expect(
      validateReservationBinding({ assetId: "asset-1", status: "APPROVED" }, "asset-1"),
    ).toBeNull();
  });
});

describe("compatibilidade de equipe", () => {
  it("rejeita equipe inativa", () => {
    expect(
      validateTeamEligibility({ status: "INACTIVE", electionId: "e1" }, "e1"),
    ).not.toBeNull();
  });

  it("rejeita equipe de outro pleito", () => {
    expect(
      validateTeamEligibility({ status: "ACTIVE", electionId: "e2" }, "e1"),
    ).not.toBeNull();
  });

  it("aceita equipe ativa do mesmo pleito", () => {
    expect(
      validateTeamEligibility({ status: "ACTIVE", electionId: "e1" }, "e1"),
    ).toBeNull();
  });
});

describe("compatibilidade de veículo e rota", () => {
  it("rejeita veículo indisponível", () => {
    expect(validateVehicleEligibility({ status: "UNAVAILABLE" })).not.toBeNull();
    expect(validateVehicleEligibility({ status: "AVAILABLE" })).toBeNull();
  });

  it("rejeita rota de outro pleito", () => {
    expect(validateRouteEligibility({ electionId: "e2" }, "e1")).not.toBeNull();
    expect(validateRouteEligibility({ electionId: "e1" }, "e1")).toBeNull();
  });
});

describe("referências de item", () => {
  it("exige referência de catálogo quando o tipo pede", () => {
    expect(validateItemReferences({ kind: "ASSET_TYPE" })).not.toBeNull();
    expect(validateItemReferences({ kind: "FIELD_TEAM" })).not.toBeNull();
    expect(validateItemReferences({ kind: "VEHICLE" })).not.toBeNull();
  });

  it("rejeita FK impossível para conceitos genéricos", () => {
    expect(
      validateItemReferences({ kind: "MATERIAL", assetTypeId: "type-1" }),
    ).not.toBeNull();
    expect(
      validateItemReferences({ kind: "OTHER", fieldTeamId: "team-1" }),
    ).not.toBeNull();
    expect(
      validateItemReferences({ kind: "TRANSPORT", vehicleId: "vehicle-1" }),
    ).not.toBeNull();
  });

  it("aceita itens coerentes", () => {
    expect(
      validateItemReferences({ kind: "ASSET_TYPE", assetTypeId: "type-1" }),
    ).toBeNull();
    expect(validateItemReferences({ kind: "MATERIAL" })).toBeNull();
    expect(
      validateItemReferences({ kind: "VEHICLE", vehicleId: "vehicle-1" }),
    ).toBeNull();
  });
});

describe("quantidades", () => {
  it("rejeita quantidade de item inválida", () => {
    expect(validateItemQuantity(0)).not.toBeNull();
    expect(validateItemQuantity(1.5)).not.toBeNull();
    expect(validateItemQuantity(1)).toBeNull();
  });

  it("rejeita atendimento acima do saldo pendente", () => {
    expect(
      validateFulfillmentQuantity({ quantity: 3, remainingQuantity: 2 }),
    ).not.toBeNull();
    expect(
      validateFulfillmentQuantity({ quantity: 2, remainingQuantity: 2 }),
    ).toBeNull();
  });
});

describe("vínculo operacional do atendimento", () => {
  it("exige vínculo para tipos que dependem de recurso real", () => {
    expect(missingOperationalLink("ASSET", {})).not.toBeNull();
    expect(missingOperationalLink("TRANSPORT", {})).not.toBeNull();
    expect(
      missingOperationalLink("ASSET", { assetId: "asset-1" }),
    ).toBeNull();
  });

  it("não exige vínculo para material e apoio genérico", () => {
    expect(missingOperationalLink("MATERIAL", {})).toBeNull();
    expect(missingOperationalLink("TECH_SUPPORT", {})).toBeNull();
  });

  it("rejeita vínculo incoerente com o tipo do item", () => {
    expect(
      linkAllowedForKind("FIELD_TEAM", { vehicleId: "vehicle-1" }),
    ).not.toBeNull();
    expect(
      linkAllowedForKind("ASSET", { fieldTeamId: "team-1" }),
    ).not.toBeNull();
    expect(
      linkAllowedForKind("TRANSPORT", { vehicleId: "vehicle-1" }),
    ).toBeNull();
    expect(
      linkAllowedForKind("FIELD_TEAM", { fieldTeamId: "team-1" }),
    ).toBeNull();
  });
});

describe("status derivado após remoção de atendimento", () => {
  it("volta para APPROVED quando o pedido já foi aprovado", () => {
    expect(
      statusWithoutFulfillment({
        approvedAt: new Date("2026-10-06T10:00:00.000Z"),
        triagedAt: new Date("2026-10-06T09:00:00.000Z"),
      }),
    ).toBe("APPROVED");
  });

  it("volta para TRIAGED quando ainda não houve aprovação", () => {
    expect(
      statusWithoutFulfillment({ approvedAt: null, triagedAt: new Date() }),
    ).toBe("TRIAGED");
  });

  it("volta para SUBMITTED quando não há triagem nem aprovação", () => {
    expect(statusWithoutFulfillment({ approvedAt: null, triagedAt: null })).toBe(
      "SUBMITTED",
    );
  });
});

describe("estados que aceitam atendimento", () => {
  it("aceita apenas APPROVED e PARTIALLY_FULFILLED", () => {
    expect(allowedFulfillmentSourceStatus("APPROVED")).toBe(true);
    expect(allowedFulfillmentSourceStatus("PARTIALLY_FULFILLED")).toBe(true);
    for (const status of ["DRAFT", "SUBMITTED", "TRIAGED", "FULFILLED", "REJECTED", "CANCELLED"] as const)
      expect(allowedFulfillmentSourceStatus(status), status).toBe(false);
  });
});
