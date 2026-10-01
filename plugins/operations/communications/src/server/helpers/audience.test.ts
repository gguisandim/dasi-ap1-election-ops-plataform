import { CommunicationAudienceType } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  audienceSignature,
  dedupeAudiences,
  describeAudience,
  recipientDedupeKey,
  validateAudienceShape,
} from "./audience";

describe("validação da regra de direcionamento", () => {
  it("aceita ALL sem alvo", () => {
    expect(validateAudienceShape({ type: CommunicationAudienceType.ALL })).toBeNull();
  });

  it("rejeita ALL com alvo preenchido", () => {
    expect(
      validateAudienceShape({
        type: CommunicationAudienceType.ALL,
        electoralZoneId: "zone-1",
      }),
    ).toContain("não aceita");
  });

  it("exige o alvo do tipo informado", () => {
    expect(validateAudienceShape({ type: CommunicationAudienceType.ELECTORAL_ZONE })).toContain(
      "electoralZoneId",
    );
    expect(
      validateAudienceShape({
        type: CommunicationAudienceType.ELECTORAL_ZONE,
        electoralZoneId: "zone-1",
      }),
    ).toBeNull();
  });

  it("rejeita dois alvos na mesma regra", () => {
    expect(
      validateAudienceShape({
        type: CommunicationAudienceType.USER,
        userId: "user-1",
        fieldTeamId: "team-1",
      }),
    ).toContain("não aceita");
  });

  it("valida cada tipo de destino suportado", () => {
    expect(
      validateAudienceShape({ type: CommunicationAudienceType.POLLING_PLACE, pollingPlaceId: "p" }),
    ).toBeNull();
    expect(
      validateAudienceShape({ type: CommunicationAudienceType.FIELD_TEAM, fieldTeamId: "t" }),
    ).toBeNull();
    expect(
      validateAudienceShape({ type: CommunicationAudienceType.OPERATIONAL_ROLE, fieldRoleId: "r" }),
    ).toBeNull();
    expect(validateAudienceShape({ type: CommunicationAudienceType.USER, userId: "u" })).toBeNull();
  });
});

describe("assinatura e deduplicação de regras", () => {
  it("gera assinatura estável por tipo e alvo", () => {
    expect(audienceSignature({ type: CommunicationAudienceType.ALL })).toBe("ALL:*");
    expect(
      audienceSignature({ type: CommunicationAudienceType.USER, userId: "u1" }),
    ).toBe("USER:u1");
  });

  it("remove regras repetidas preservando a ordem", () => {
    const result = dedupeAudiences([
      { type: CommunicationAudienceType.USER, userId: "u1" },
      { type: CommunicationAudienceType.ALL },
      { type: CommunicationAudienceType.USER, userId: "u1" },
      { type: CommunicationAudienceType.USER, userId: "u2" },
    ]);
    expect(result).toHaveLength(3);
    expect(result.map(audienceSignature)).toEqual(["USER:u1", "ALL:*", "USER:u2"]);
  });
});

describe("chave de deduplicação de destinatário", () => {
  it("identifica usuários da plataforma", () => {
    expect(recipientDedupeKey({ userId: "u1", name: "Ana" })).toBe("user:u1");
  });

  it("identifica membros de campo", () => {
    expect(recipientDedupeKey({ memberId: "m1", name: "Carlos" })).toBe("member:m1");
  });

  it("cai para o nome normalizado quando não há identidade conhecida", () => {
    expect(recipientDedupeKey({ name: "  Marina Lopes " })).toBe("name:marina lopes");
  });
});

describe("descrição da regra", () => {
  it("descreve cada tipo com o rótulo disponível", () => {
    expect(describeAudience({ type: CommunicationAudienceType.ALL })).toContain("Todos");
    expect(
      describeAudience(
        { type: CommunicationAudienceType.ELECTORAL_ZONE, electoralZoneId: "z1" },
        { electoralZone: "76 · Centro" },
      ),
    ).toBe("Zona 76 · Centro");
    expect(
      describeAudience(
        { type: CommunicationAudienceType.FIELD_TEAM, fieldTeamId: "t1" },
        { fieldTeam: "Equipe Alfa" },
      ),
    ).toBe("Equipe Equipe Alfa");
  });

  it("usa o identificador quando não há rótulo", () => {
    expect(
      describeAudience({ type: CommunicationAudienceType.USER, userId: "u9" }),
    ).toBe("Usuário u9");
  });
});
