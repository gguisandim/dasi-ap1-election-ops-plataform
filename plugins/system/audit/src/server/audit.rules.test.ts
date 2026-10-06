import { AuditEventSeverity } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  AUDIT_PAYLOAD_MAX_BYTES,
  buildAuditDiff,
  byteSize,
  canReadCategory,
  copyScopeFields,
  deriveCategory,
  deriveSeverity,
  partitionCategories,
  sanitizeAuditValue,
  truncateAuditPayload,
} from "./audit.rules";

describe("deriveCategory", () => {
  it("uses the event name namespace", () => {
    expect(deriveCategory("incident.status_changed", "Incident")).toBe("incident");
    expect(deriveCategory("resource_request.approved", "ResourceRequest")).toBe("resource_request");
  });

  it("falls back to kebab-cased entity type when the event name is missing", () => {
    expect(deriveCategory(null, "CommandCenterSnapshot")).toBe("command-center-snapshot");
    expect(deriveCategory("  ", "Incident")).toBe("incident");
  });
});

describe("deriveSeverity", () => {
  it("maps the four normative levels", () => {
    expect(deriveSeverity("incident.failed")).toBe(AuditEventSeverity.CRITICAL);
    expect(deriveSeverity("incident.escalated")).toBe(AuditEventSeverity.CRITICAL);
    expect(deriveSeverity("route.cancelled")).toBe(AuditEventSeverity.CRITICAL);
    expect(deriveSeverity("incident.status_changed")).toBe(AuditEventSeverity.WARNING);
    expect(deriveSeverity("incident.severity_changed")).toBe(AuditEventSeverity.WARNING);
    expect(deriveSeverity("route.created")).toBe(AuditEventSeverity.NOTICE);
    expect(deriveSeverity("incident.resolved")).toBe(AuditEventSeverity.INFO);
  });
});

describe("copyScopeFields", () => {
  it("copies string scope fields and never infers", () => {
    expect(copyScopeFields({ electionId: "e1", electoralZoneId: "z1", other: 1 })).toEqual({
      electionId: "e1",
      electoralZoneId: "z1",
    });
    expect(copyScopeFields({ electionId: 42, electoralZoneId: null })).toEqual({
      electionId: undefined,
      electoralZoneId: undefined,
    });
  });
});

describe("sanitizeAuditValue", () => {
  it("redacts every sensitive substring recursively, preserving safe context", () => {
    const result = sanitizeAuditValue({
      email: "op@example.test",
      password: "p",
      senha: "p",
      passwd: "p",
      token: "p",
      secret: "p",
      Authorization: "p",
      apiKey: "p",
      api_key: "p",
      credential: "p",
      refresh_token: "p",
      access_token: "p",
      private_key: "p",
      certificate: "p",
      hash: "p",
      Cookie: "p",
      sessionId: "p",
      cpf: "p",
      nested: { safe: true, token: "p" },
      list: [{ cpf: "p" }],
    }) as Record<string, unknown>;

    expect(result.email).toBe("op@example.test");
    for (const key of [
      "password",
      "senha",
      "passwd",
      "token",
      "secret",
      "Authorization",
      "apiKey",
      "api_key",
      "credential",
      "refresh_token",
      "access_token",
      "private_key",
      "certificate",
      "hash",
      "Cookie",
      "sessionId",
      "cpf",
    ]) {
      expect(result[key]).toBe("[REDACTED]");
    }
    expect(result.nested).toEqual({ safe: true, token: "[REDACTED]" });
    expect(result.list).toEqual([{ cpf: "[REDACTED]" }]);
  });
});

describe("truncateAuditPayload", () => {
  it("keeps payloads within the size limit untouched", () => {
    const small = { value: 1 };
    expect(truncateAuditPayload(small)).toBe(small);
  });

  it("truncates payloads above 8 KB with a marker instead of rejecting", () => {
    const result = truncateAuditPayload({ blob: "x".repeat(AUDIT_PAYLOAD_MAX_BYTES + 100) }) as {
      truncated: boolean;
      marker: string;
      preview: string;
    };
    expect(result.truncated).toBe(true);
    expect(result.marker).toBe("[TRUNCATED]");
    expect(byteSize(result.preview)).toBeLessThanOrEqual(AUDIT_PAYLOAD_MAX_BYTES);
  });
});

describe("buildAuditDiff", () => {
  it("unions both sides, counts equals as unchanged and nulls the missing side", () => {
    const diff = buildAuditDiff({ a: 1, b: 2, c: 3 }, { a: 1, b: 5, d: 4 });
    expect(diff.unchanged).toBe(1);
    expect(diff.truncated).toBe(false);
    expect(diff.changed).toEqual([
      { field: "b", before: 2, after: 5 },
      { field: "c", before: 3, after: null },
      { field: "d", before: null, after: 4 },
    ]);
  });

  it("caps changed entries at 200 and flags truncation", () => {
    const after: Record<string, number> = {};
    for (let index = 0; index < 250; index += 1) after[`k${index}`] = index;
    const diff = buildAuditDiff({}, after);
    expect(diff.changed).toHaveLength(200);
    expect(diff.truncated).toBe(true);
  });
});

describe("partitionCategories", () => {
  it("allows mapped categories with the permission and denies the rest by default", () => {
    const access = partitionCategories(["incident", "asset", "unknown"], ["inventory.read"]);
    expect(access.allowed).toEqual(["asset"]);
    expect(access.restricted).toEqual(["incident", "unknown"]);
  });

  it("denies unmapped and null categories", () => {
    expect(canReadCategory("mystery", ["mystery.read"])).toBe(false);
    expect(canReadCategory(null, ["incidents.read"])).toBe(false);
    expect(canReadCategory("incident", ["incidents.read"])).toBe(true);
  });
});
